const jwt = require("jsonwebtoken");
const User = require("../models/user");
const ProfileUpdateRequest = require("../models/profileUpdateRequest");
const cloudinary = require("../config/cloudinary");

// Generate JWT token (safe default for tests)
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || "test-secret"; // <-- fallback avoids 500s in CI/tests
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    secret,
    { expiresIn: "1h" }
  );
};

// Register (unchanged)
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, state } = req.body;

    if (role === "admin") {
      return res
        .status(403)
        .json({ message: "Admin accounts cannot be self-registered" });
    }

    const user = new User({ name, email, password, role, state });
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login (fixed)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // If your schema sets password { select: false }, this ensures we get it for compare
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Protect against compare throwing if hash is missing/invalid
    const ok = await user.comparePassword(password).catch(() => false);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        state: user.state,
        active: user.active,
        profilePicture: user.profilePicture || null,
      },
    });
  } catch (err) {
    // Don’t leak internals
    res.status(500).json({ error: "Login failed" });
  }
};

// Get profile (unchanged)
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const pendingRequest = await ProfileUpdateRequest.findOne({
      user: req.user.id,
      status: "pending",
    });

    const userObj = user.toObject();
    userObj.pendingApproval = !!pendingRequest;

    res.json(userObj);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update profile (unchanged)
exports.updateProfile = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Admins cannot update profile." });
    }

    const updates = {
      name: req.body.name,
      state: req.body.state,
      profilePic: req.body.profilePic,
    };

    console.log("Profile update requested:", updates);
    await User.findByIdAndUpdate(req.user.id, { pendingApproval: updates });

    await ProfileUpdateRequest.create({
      user: req.user.id,
      updates,
    });

    res.json({ message: "Profile update submitted for admin approval." });
  } catch (err) {
    res.status(500).json({ message: "Update failed." });
  }
};

// Delete profile picture (unchanged)
exports.deleteProfilePicture = async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Admins cannot update profile." });
    }

    await User.findByIdAndUpdate(req.user.id, { $unset: { profilePic: "" } });

    res.json({ message: "Profile picture deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete picture." });
  }
};
