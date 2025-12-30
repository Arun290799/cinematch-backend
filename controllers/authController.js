const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Generate JWT Token
const generateToken = (id) => {
	return jwt.sign({ id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRE || "30d",
	});
};

// Set token in HTTP-only cookie
const sendTokenResponse = (user, statusCode, res) => {
	const token = generateToken(user._id);

	const options = {
		expires: new Date(
			Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
		),
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
	};

	res.status(statusCode)
		.cookie("token", token, options)
		.json({
			success: true,
			token,
			data: {
				_id: user._id,
				name: user.name,
				email: user.email,
				avatar: user.avatar,
				createdAt: user.createdAt,
			},
		});
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
	try {
		const { name, email, password } = req.body;

		// Check if user exists
		let user = await User.findOne({ email });
		if (user) {
			return res.status(400).json({
				success: false,
				message: "User already exists with this email",
			});
		}

		// Create user
		user = await User.create({
			name,
			email,
			password,
		});

		sendTokenResponse(user, 201, res);
	} catch (error) {
		next(error);
	}
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
	try {
		const { email, password } = req.body;

		// Check if user exists
		const user = await User.findOne({ email }).select("+password");
		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		// Check if password matches
		const isMatch = await user.matchPassword(password);
		if (!isMatch) {
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		sendTokenResponse(user, 200, res);
	} catch (error) {
		next(error);
	}
};

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
	try {
		res.status(200)
			.cookie("token", "none", {
				expires: new Date(Date.now() + 10 * 1000),
				httpOnly: true,
			})
			.json({
				success: true,
				data: {},
			});
	} catch (error) {
		next(error);
	}
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
	try {
		const user = await User.findById(req.user.id).select("-password");

		res.status(200).json({
			success: true,
			data: user,
		});
	} catch (error) {
		next(error);
	}
};
