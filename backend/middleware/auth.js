const jwt = require('jsonwebtoken');

// Reads the `token` httpOnly cookie set at login, verifies it, and attaches
// { id, name, email } to req.user. Responds 401 if missing/invalid.
function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, name: payload.name, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

module.exports = { requireAuth };
