import { sharedState } from './model.js';

(() => {
  let client = null;
  let session = null;
  let workspace = null;
  let profile = null;
  let team = null;
  let role = null;
  let people = [];
  let saveTimer = null;
  let saveChain = Promise.resolve();
  let saveRevision = 0;

  const config = () => window.RUMBO_CLOUD || {};
  const configured = () => Boolean(config().url && config().anonKey && window.supabase?.createClient);
  const fail = error => { throw new Error(error?.message || 'No se pudo completar la acción.'); };
  const workspaceFields = 'id,name,owner_id';
  const inviteToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), byte => byte.toString(16).padStart(2, '0')).join('');

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

  async function signUp({ fullName, position, email, password }) {
    localStorage.setItem('rumbo.pendingPosition', position);
    const result = await client.auth.signUp({ email, password, options: { data: { full_name: fullName, position } } });
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
    session = null; workspace = null; profile = null; team = null; role = null; people = [];
  }

  async function loadProfile() {
    const result = await client.from('profiles').select('id,email,full_name,position').eq('id', session.user.id).single();
    if (result.error) fail(result.error);
    profile = result.data;
  }

  async function acceptPendingInvite() {
    const token = localStorage.getItem('rumbo.pendingInvite');
    if (!token) return;
    const result = await client.rpc('join_team', { invite_token: token, member_position: localStorage.getItem('rumbo.pendingPosition') || '' });
    if (result.error) fail(result.error);
    localStorage.removeItem('rumbo.pendingInvite');
    localStorage.removeItem('rumbo.pendingPosition');
  }

  async function loadTeam() {
    const result = await client.from('team_members').select('team_id,role,position,teams(name)').eq('user_id', session.user.id).limit(1).maybeSingle();
    if (result.error) fail(result.error);
    team = result.data ? { id: result.data.team_id, name: result.data.teams?.name || 'Mi equipo', position: result.data.position } : null;
    role = result.data?.role || 'collaborator';
  }

  async function loadPeople() {
    const result = await client.rpc('admin_dashboard');
    if (result.error) fail(result.error);
    people = result.data || [];
    return people;
  }

  async function saveNow(state) {
    if (!workspace || role === 'admin') return;
    const updatedAt = new Date().toISOString();
    const privateResult = await client.from('private_states').upsert({ workspace_id: workspace.id, data: state, updated_at: updatedAt });
    if (privateResult.error) fail(privateResult.error);
    const sharedResult = await client.from('shared_states').upsert({ workspace_id: workspace.id, data: sharedState(state), updated_at: updatedAt });
    if (sharedResult.error) fail(sharedResult.error);
  }

  async function ensureWorkspace(localState) {
    const preferredId = localStorage.getItem('rumbo.workspace');
    let result = preferredId
      ? await client.from('workspaces').select(workspaceFields).eq('owner_id', session.user.id).eq('id', preferredId).maybeSingle()
      : { data: null, error: null };
    if (!result.data && !result.error) result = await client.from('workspaces').select(workspaceFields).eq('owner_id', session.user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (result.error) fail(result.error);
    if (!result.data) {
      result = await client.from('workspaces').insert({ owner_id: session.user.id, name: 'Mi aprendizaje' }).select(workspaceFields).single();
      if (result.error) fail(result.error);
      workspace = result.data;
      await saveNow(localState);
      return localState;
    }
    workspace = result.data;
    const stored = await client.from('private_states').select('data').eq('workspace_id', workspace.id).maybeSingle();
    if (stored.error) fail(stored.error);
    if (!stored.data) await saveNow(localState);
    return stored.data?.data || localState;
  }

  async function bootstrap(localState) {
    if (!session) return null;
    await loadProfile();
    await acceptPendingInvite();
    await loadTeam();
    if (role === 'admin') {
      await loadPeople();
      return { state: localState, workspace: null, role, email: session.user.email, profile, team, people };
    }
    const nextState = await ensureWorkspace(localState);
    localStorage.setItem('rumbo.workspace', workspace.id);
    return { state: nextState, workspace, role: 'collaborator', email: session.user.email, profile, team, people: [] };
  }

  function scheduleSave(state, onSuccess, onError) {
    if (!workspace || role === 'admin') return;
    const revision = ++saveRevision;
    const snapshot = structuredClone(state);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveChain = saveChain.catch(() => {}).then(() => saveNow(snapshot));
      saveChain.then(() => { if (revision === saveRevision) onSuccess(); })
        .catch(error => { if (revision === saveRevision) onError(error); });
    }, 600);
  }

  async function createInvite() {
    if (role !== 'admin' || !team) throw new Error('Solo un administrador puede invitar colaboradores.');
    const token = inviteToken();
    const result = await client.from('team_invites').insert({ team_id: team.id, token, created_by: session.user.id }).select('token').single();
    if (result.error) fail(result.error);
    return `${location.origin}${location.pathname}?invite=${result.data.token}`;
  }

  async function updateProfile(fullName, position) {
    const result = await client.rpc('update_my_profile', { new_full_name: fullName, new_position: position });
    if (result.error) fail(result.error);
    profile = { ...profile, full_name: result.data.full_name, position: result.data.position };
    if (team) team = { ...team, position: result.data.position };
    return { profile, team };
  }

  function rememberInvite(token) {
    if (token) localStorage.setItem('rumbo.pendingInvite', token);
  }

  window.RumboCloud = {
    configured, init, signUp, signIn, signOut, bootstrap, scheduleSave, loadPeople, createInvite, updateProfile, rememberInvite,
    get session() { return session; }, get workspace() { return workspace; }, get role() { return role; }, get profile() { return profile; }, get team() { return team; }, get people() { return people; }
  };
})();
