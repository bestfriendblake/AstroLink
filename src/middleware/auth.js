const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies?.astrolink_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid session' });
  }
}

function requireLevel(minLevel) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.globalLevel < minLevel) {
      return res.status(403).json({
        error: `Global Level ${minLevel} required`,
        currentLevel: req.user.globalLevel,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireLevel };