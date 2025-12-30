const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes
exports.protect = async (req, res, next) => {
	let token;
	// Get token from cookie
	if (req.cookies.token) {
		token = req.cookies.token;
	}
	// Get token from Authorization header (Bearer token)
	else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
		token = req.headers.authorization.split(" ")[1];
	}

	// Make sure token exists
	if (!token) {
		return res.status(401).json({
			success: false,
			message: "Not authorized to access this route",
		});
	}

	try {
		// Verify token
		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		// Get user from the token
		req.user = await User.findById(decoded.id).select("-password");

		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: "User not found",
			});
		}

		next();
	} catch (error) {
		console.error(error);
		return res.status(401).json({
			success: false,
			message: "Not authorized to access this route",
		});
	}
};

