const ProfileUpdateRequest = require("../models/profileUpdateRequest");
const User = require("../models/user");

// Get all pending profile update requests
exports.getPendingProfileRequests = async (req, res) => {
  try {
    const requests = await ProfileUpdateRequest.find({ status: "pending" }).populate("user");
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch requests." });
  }
};

// Approve a profile update request
exports.approveProfileUpdate = async (req, res) => {
  try {
    const request = await ProfileUpdateRequest.findById(req.params.id).populate("user");
    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Request not found or already processed." });
    }

    // Apply updates to user profile
    await User.findByIdAndUpdate(request.user._id, { ...request.updates, pendingApproval: null });

    // Update request status
    request.status = "approved";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    res.json({ message: "Profile update approved and applied." });
  } catch (err) {
    res.status(500).json({ message: "Failed to approve request." });
  }
};

// Decline a profile update request
exports.declineProfileUpdate = async (req, res) => {
  try {
    const request = await ProfileUpdateRequest.findById(req.params.id).populate("user");
    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Request not found or already processed." });
    }

    // Remove pendingApproval from user and set lastDeclinedUpdate
    await User.findByIdAndUpdate(request.user._id, {
      $unset: { pendingApproval: "" },
      $set: { lastDeclinedUpdate: { date: new Date(), reason: request.reason || "" } }
    });

    // Update request status
    request.status = "declined";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    request.reason = req.body.reason || "";
    await request.save();

    res.json({ message: "Profile update declined." });
  } catch (err) {
    res.status(500).json({ message: "Failed to decline request. " + err.message });
  }
};

// Get all profile update requests (history) for a user
exports.getUserProfileUpdateHistory = async (req, res) => {
  try {
    const requests = await ProfileUpdateRequest.find({ user: req.params.userId }).sort({ requestedAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch history." });
  }
};

// Clear decline flag for a user
exports.clearDeclineFlag = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $unset: { lastDeclinedUpdate: "" } });
    res.json({ message: "Decline flag cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear decline flag." });
  }
};