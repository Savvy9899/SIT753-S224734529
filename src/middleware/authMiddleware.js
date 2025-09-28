const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
  // Bearer header first
  let token = req.headers["authorization"]?.split(" ")[1];
  // Fallback - read from cookies
  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(p => {
        const i = p.indexOf('=');
        const k = decodeURIComponent(p.slice(0, i).trim());
        const v = decodeURIComponent(p.slice(i + 1));
        return [k, v];
      })
    );
    token = cookies.token || null;
  }
  if (!token) return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, name }
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Role check
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
