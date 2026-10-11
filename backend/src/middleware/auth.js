const jwt = require('jsonwebtoken');

// Question 1: WHO are you?  (authentication)
// Reads the token from the "Authorization: Bearer <token>" header.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Login required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role, name }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Question 2: ARE YOU ALLOWED to do this?  (authorization)
// Usage: router.post('/approve', authenticate, authorize('director'), handler)
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied for your role' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };