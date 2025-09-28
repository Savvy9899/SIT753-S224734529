const User = require("../models/user");

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users." });
  }
};

// Delete a user permanently (admin only)
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user." });
  }
};

// Toggle user active/inactive (admin only)
exports.toggleUserActive = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { active: req.body.active });
    res.json({ message: "User status updated." });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user status." });
  }
};

// Bulk delete users (admin only)
exports.bulkDeleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No user IDs provided." });
    }
    await User.deleteMany({ _id: { $in: ids } });
    res.json({ message: "Selected users deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to bulk delete users." });
  }
};