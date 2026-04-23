/* ============================================================
   VROUM.IO — Auth (Supabase Auth)
   ============================================================ */

let currentUser = null; // { id, email, username }

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { currentUser = null; return null; }
  await _loadProfile(session.user);
  return currentUser;
}

function isLoggedIn() { return currentUser !== null; }
function getUser()    { return currentUser; }

async function register(username, email, password) {
  username = username.trim();
  email    = email.trim().toLowerCase();

  if (!username || username.length < 2) return { error: 'Pseudo trop court (2 caractères min.)' };
  if (!email.includes('@'))             return { error: 'Email invalide' };
  if (password.length < 6)             return { error: 'Mot de passe trop court (6 caractères min.)' };

  // Check username availability
  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existing) return { error: 'Ce pseudo est déjà pris' };

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) return { error: _friendlyError(error.message) };

  // If email confirmation is required, data.session will be null
  if (!data.session) {
    return { error: 'Inscription réussie ! Vérifie ton email pour confirmer ton compte, puis connecte-toi.' };
  }

  await _loadProfile(data.user);
  return { user: currentUser };
}

async function login(email, password) {
  email = email.trim().toLowerCase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: _friendlyError(error.message) };
  await _loadProfile(data.user);
  return { user: currentUser };
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
}

async function updateProfile(updates) {
  if (!currentUser) return false;
  currentUser = { ...currentUser, ...updates };
  const { error } = await sb
    .from('profiles')
    .update({ username: currentUser.username })
    .eq('id', currentUser.id);
  if (error) { toast('Erreur mise à jour profil', 'error'); return false; }
  return true;
}

async function _loadProfile(sbUser) {
  const { data: profile } = await sb
    .from('profiles')
    .select('username')
    .eq('id', sbUser.id)
    .maybeSingle();

  currentUser = {
    id:       sbUser.id,
    email:    sbUser.email,
    username: profile?.username
              || sbUser.user_metadata?.username
              || sbUser.email?.split('@')[0]
              || 'Utilisateur',
  };
}

function _friendlyError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect';
  if (msg.includes('Email not confirmed'))        return 'Confirme ton email avant de te connecter';
  if (msg.includes('User already registered'))    return 'Cet email est déjà utilisé';
  if (msg.includes('Password should be'))         return 'Mot de passe trop court (6 caractères min.)';
  return msg;
}
