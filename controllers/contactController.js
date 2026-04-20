const Contact = require("../models/Contact");
const axios = require("axios");

// Formspree configuration
const FORMSPREE_FORM_ID = process.env.FORMSPREE_FORM_ID;
const FORMSPREE_ENDPOINT = `https://formspree.io/f/${FORMSPREE_FORM_ID}`;

if (!FORMSPREE_FORM_ID) {
	console.warn("Formspree form ID not configured. Email notifications will be disabled.");
}

const submitContact = async (req, res) => {
	try {
		const { name, email, message } = req.body;

		// Validate required fields
		if (!name || !email || !message) {
			return res.status(400).json({
				success: false,
				message: "All fields are required",
			});
		}

		// Create contact entry in database
		const contact = new Contact({
			name,
			email,
			message,
		});

		await contact.save();

		// Send notification to Formspree asynchronously
		if (FORMSPREE_FORM_ID) {
			setImmediate(async () => {
				try {
					const formData = {
						name: name,
						email: email,
						message: message,
						subject: `Contact Form: Message from ${name}`,
						_formspree: {
							origin: window?.location?.origin || "CinemaMatch Backend",
							timestamp: new Date().toISOString(),
						},
					};

					const response = await axios.post(FORMSPREE_ENDPOINT, formData, {
						headers: {
							Accept: "application/json",
							"Content-Type": "application/json",
						},
					});

					console.log("?? [FORMSPREE SUCCESS] Contact form submitted to Formspree:", response.data);
				} catch (formspreeError) {
					console.error(
						"?? [FORMSPREE ERROR] Failed to submit to Formspree:",
						formspreeError.response?.data || formspreeError.message,
					);
				}
			});
		} else {
			console.warn("?? [FORMSPREE WARNING] Formspree not configured - skipping notification");
		}

		res.status(201).json({
			success: true,
			message: "Contact form submitted successfully",
			data: {
				id: contact._id,
				name: contact.name,
				email: contact.email,
				createdAt: contact.createdAt,
			},
		});
	} catch (error) {
		console.error("Contact submission error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: process.env.NODE_ENV === "development" ? error.message : undefined,
		});
	}
};

module.exports = {
	submitContact,
};
