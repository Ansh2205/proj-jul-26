const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. Database Connection (Same as server.js)
const MONGO_URI = 'mongodb://localhost:27017/project-july-26';

// 2. User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

async function createAdmin() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        // --- CHANGE THESE CREDENTIALS ---
        const email = 'admin@admin.com'; 
        const plainPassword = 'Ansh@2204'; 
        // -------------------------------

        // Hash the password (security best practice)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);

        const admin = new User({
            email: email,
            password: hashedPassword
        });

        await admin.save();
        console.log('Admin user created successfully!');

    } catch (error) {
        if (error.code === 11000) {
            console.log('Admin user already exists.');
        } else {
            console.error('Error:', error);
        }
    } finally {
        mongoose.connection.close();
    }
}

createAdmin();