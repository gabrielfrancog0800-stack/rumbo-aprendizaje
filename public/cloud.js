import { sharedState } from './model.js';

(() => {
  let client = null;
  let session = null;
  let workspace = null;
  let role = null;
  let saveTimer = null;
  let saveChain = Promise.resolve();
  let saveRevision = 0;

  const config = () => window.RUMBO_CLOUD || {};
  const configured = () => Boolean(config().url && config().anonKey && window.supabase?.createClient);
  const shareCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  const fail = error => { throw new Error(error?.message || 'No se pudo completar la acción.'); };
  const workspaceFields = 'id,name,owner_id';

  async function init(onAuthChange) {
    if (!configured()) return { configured: false };
    client = window.supabase.createClient(config().url, config().anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const result = await client.auth.getSession();
    if (result.error) fail(result.error);
    session = result.data.session;
    client.auth.onAuthStateChange((event, next) => {
      session = next;
      if (onAuthChange) onAuthChange(next, event);
    });
    return { configured: true, session };
  }

  async function signUp(email, password) {
    const result = await client.auth.signUp({ email, password });
    if (result.error) fail(result.error);
    session = result.data.session;
    return { session, needsConfirmation: !session };
  }

  async function signIn(email, password) {
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) fail(result.error);
    session = result.data.session;
    return session;
  }

  async function signOut() {
    const result = await client.auth.signOut();
    if (result.error) fail(result.error);
    session = null; workspace = null; role = null;
  }

  async function addOwnerInvite() {
    const invite = await client.from('workspace_invites').select('share_code').eq('workspace_id', workspace.id).single();
    if (invite.error) fail(invite.error);
    workspace = { ...workspace, share_code: invite.data.share_code };
  }

  async function bootstrap(localState, preferredWorkspaceId = localStorage.getItem('rumbo.workspace')) {
    if (!session) return null;
    const userId = session.user.id;
    workspace = null; role = null;
    if (preferredWorkspaceId) {
      const preferred = await client.from('workspaces').select(workspaceFields).eq('id', preferredWorkspaceId).maybeSingle();
      if (preferred.error) fail(preferred.error);
      if (preferred.data) { workspace = preferred.data; role = workspace.owner_id === userId ? 'owner' : 'viewer'; }
    }
    let result = { data: null, error: null };
    if (!workspace) result = await client.from('workspaces').select(workspaceFields).eq('owner_id', userId).limit(1).maybeSingle();
    if (result.error) fail(result.error);
    if (!workspace) { workspace = result.data; role = workspace ? 'owner' : null; }
    if (!workspace) {
      const membership = await client.from('workspace_members').select('workspace_id,role').eq('user_id', userId).limit(1).maybeSingle();
      if (membership.error) fail(membership.error);
      if (membership.data) {
        const found = await client.from('workspaces').select(workspaceFields).eq('id', membership.data.workspace_id).single();
        if (found.error) fail(found.error);
        workspace = found.data; role = 'viewer';
      }
    }
    if (!workspace) {
      const created = await client.from('workspaces').insert({ owner_id: userId, name: 'Mi aprendizaje' }).select(workspaceFields).single();
      if (created.error) fail(created.error);
      workspace = created.data; role = 'owner';
      const invite = await client.from('workspace_invites').insert({ workspace_id: workspace.id, share_code: shareCode() }).select('share_code').single();
      if (invite.error) fail(invite.error);
      workspace = { ...workspace, share_code: invite.data.share_code };
      localStorage.setItem('rumbo.workspace', workspace.id);
      localStorage.setItem('rumbo.ownerWorkspace', workspace.id);
      await saveNow(localState);
      return { state: localState, workspace, role, email: session.user.email };
    }
    localStorage.setItem('rumbo.workspace', workspace.id);
    if (role === 'owner') {
      localStorage.setItem('rumbo.ownerWorkspace', workspace.id);
      await addOwnerInvite();
    }
    const table = role === 'owner' ? 'private_states' : 'shared_states';
    const stored = await client.from(table).select('data').eq('workspace_id', workspace.id).maybeSingle();
    if (stored.error) fail(stored.error);
    if (!stored.data && role === 'owner') await saveNow(localState);
    return { state: stored.data?.data || localState, workspace, role, email: session.user.email };
  }

  async function saveNow(state) {
    if (!workspace || role !== 'owner') return;
    const updatedAt = new Date().toISOString();
    const privateResult = await client.from('private_states').upsert({ workspace_id: workspace.id, data: state, updated_at: updatedAt });
    if (privateResult.error) fail(privateResult.error);
    const sharedResult = await client.from('shared_states').upsert({ workspace_id: workspace.id, data: sharedState(state), updated_at: updatedAt });
    if (sharedResult.error) fail(sharedResult.error);
  }

  function scheduleSave(state, onSuccess, onError) {
    if (!workspace || role !== 'owner') return;
    const revision = ++saveRevision;
    const snapshot = structuredClone(state);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveChain = saveChain.catch(() => {}).then(() => saveNow(snapshot));
      saveChain.then(() => { if (revision === saveRevision) onSuccess(); })
        .catch(error => { if (revision === saveRevision) onError(error); });
    }, 600);
  }

  async function join(code, localState) {
    const result = await client.rpc('join_workspace', { invite_code: code.trim() });
    if (result.error) fail(result.error);
    workspace = null; role = null;
    return bootstrap(localState, result.data?.[0]?.workspace_id);
  }

  async function renewCode() {
    if (role !== 'owner') throw new Error('Solo el propietario puede cambiar el código.');
    const code = shareCode();
    const result = await client.from('workspace_invites').update({ share_code: code, updated_at: new Date().toISOString() }).eq('workspace_id', workspace.id).select('share_code').single();
    if (result.error) fail(result.error);
    workspace = { ...workspace, share_code: result.data.share_code };
    return workspace;
  }

  async function switchToOwned(localState) {
    const ownerWorkspaceId = localStorage.getItem('rumbo.ownerWorkspace');
    if (!ownerWorkspaceId) throw new Error('No encontramos tu espacio personal.');
    workspace = null; role = null;
    return bootstrap(localState, ownerWorkspaceId);
  }

  window.RumboCloud = { configured, init, signUp, signIn, signOut, bootstrap, scheduleSave, join, renewCode, switchToOwned, get session() { return session; }, get workspace() { return workspace; }, get role() { return role; } };
})();
