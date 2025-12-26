/*
=================================================================
  PROJECT JULY 26 - MASTER SERVER
  Hosts the Website + API + Database + Admin Panel
=================================================================
*/

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// --- 1. MIDDLEWARE ---
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));
app.use('/Assets', express.static(path.join(__dirname, 'Assets')));

// --- 2. CONFIGURATION ---
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI ;
const JWT_SECRET = process.env.JWT_SECRET ;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ;
const RAZORPAY_SECRET_KEY = process.env.RAZORPAY_SECRET_KEY;

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_SECRET_KEY });

// --- 3. DATABASE & SCHEMAS ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Error:', err));

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const MemberSchema = new mongoose.Schema({ name: String, email: String, phone: String });
const TeamSchema = new mongoose.Schema({ teamName: String, eventValue: String, eventName: String, members: [MemberSchema] });
const RegistrationSchema = new mongoose.Schema({
    organization: { name: String, contactPerson: String, contactEmail: String, contactPhone: String },
    teams: [TeamSchema],
    subTotal: Number, convenienceFee: Number, grandTotal: Number,
    paymentStatus: { type: String, default: 'pending' },
    orderId: String, paymentId: String,
}, { timestamps: true });
const Registration = mongoose.model('Registration', RegistrationSchema);

// --- 4. AUTH MIDDLEWARE ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- 5. HELPER: DESIGNER CERTIFICATE DRAWING ---
const drawEnhancedCertificate = (doc, reg, team, student) => {
    const width = doc.page.width;
    const height = doc.page.height;
    const dateStr = new Date(reg.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // 1. Background (Elegant Cream/Parchment)
    doc.rect(0, 0, width, height).fill('#fffef2');

    // 2. Ornate Border Design
    doc.rect(20, 20, width - 40, height - 40).lineWidth(12).stroke('#1e293b'); 
    doc.rect(40, 40, width - 80, height - 80).lineWidth(1).stroke('#d4af37');
    doc.rect(45, 45, width - 90, height - 90).lineWidth(0.5).stroke('#d4af37');

    const drawCornerDetail = (x, y, rotation) => {
        doc.save().translate(x, y).rotate(rotation);
        doc.rect(-15, -15, 30, 30).fill('#1e293b');
        doc.rect(-8, -8, 16, 16).fill('#d4af37');
        doc.restore();
    };
    drawCornerDetail(20, 20, 0); drawCornerDetail(width-20, 20, 90);
    drawCornerDetail(width-20, height-20, 180); drawCornerDetail(20, height-20, 270);

    // 3. Top Branding (Reduced font by ~10%)
    doc.fillColor('#1e293b');
    doc.fontSize(32).font('Helvetica-Bold').text('PROJECT JULY 26', 0, 60, { align: 'center', characterSpacing: 4 });
    
    // 4. Main Titles (Reduced font by ~10%)
    doc.fontSize(48).font('Times-Bold').text('CERTIFICATE', 0, 115, { align: 'center', characterSpacing: 6 });
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#64748b').text('OF EXCELLENCE & PARTICIPATION', 0, 175, { align: 'center', characterSpacing: 3 });
    
    // 5. Presentation Text
    doc.fontSize(18).font('Times-Italic').fillColor('#475569').text('This is proudly presented to', 0, 225, { align: 'center' });
    
    // 6. Recipient Name
    doc.fontSize(45).font('Times-BoldItalic').fillColor('#0f172a').text(student.name, 0, 270, { align: 'center' });
    doc.moveTo(width * 0.2, 330).lineTo(width * 0.8, 330).lineWidth(1).stroke('#d4af37');

    // 7. Event Details
    doc.fontSize(14).font('Helvetica').fillColor('#475569').text('for their active and successful participation in', 0, 360, { align: 'center' });
    doc.fontSize(25).font('Helvetica-Bold').fillColor('#1e293b').text(team.eventName.toUpperCase(), 0, 390, { align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#64748b').text(`Representing Team: ${team.teamName} | ${reg.organization.name}`, 0, 435, { align: 'center' });

    // 8. Signature Area
    const sigY = 500;
    const sigLineWidth = 180;
    const sideMargin = 90;

    // Signature 1: EVENT HEAD (Left)
    const x1 = sideMargin;
    doc.moveTo(x1, sigY).lineTo(x1 + sigLineWidth, sigY).lineWidth(1.5).stroke('#1e293b');
    doc.fontSize(10).font('Times-Bold').fillColor('#1e293b').text('EVENT HEAD', x1, sigY + 12, { width: sigLineWidth, align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(`Date: ${dateStr}`, x1, sigY + 28, { width: sigLineWidth, align: 'center' });

    // Signature 2: FOUNDER (Center)
    const x2 = (width / 2) - (sigLineWidth / 2);
    doc.moveTo(x2, sigY).lineTo(x2 + sigLineWidth, sigY).stroke('#1e293b');
    doc.fontSize(10).font('Times-Bold').fillColor('#1e293b').text('FOUNDER', x2, sigY + 12, { width: sigLineWidth, align: 'center' });

    // Signature 3: CO-FOUNDER (Right)
    const x3 = width - sideMargin - sigLineWidth;
    doc.moveTo(x3, sigY).lineTo(x3 + sigLineWidth, sigY).stroke('#1e293b');
    doc.fontSize(10).font('Times-Bold').fillColor('#1e293b').text('CO-FOUNDER', x3, sigY + 12, { width: sigLineWidth, align: 'center' });
};

// --- 6. ROUTES ---

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'User not found' });
        if (!await bcrypt.compare(password, user.password)) return res.status(400).json({ error: 'Invalid password' });
        const token = jwt.sign({ _id: user._id, email: user.email }, JWT_SECRET);
        res.json({ token });
    } catch (err) { res.status(500).json({ error: 'Login error' }); }
});

// Create Order (Payment Gateway Integration)
app.post('/create-order', async (req, res) => {
    try {
        const regData = req.body;
        const newReg = new Registration({ ...regData, paymentStatus: 'pending' });
        const savedReg = await newReg.save();
        
        const order = await razorpay.orders.create({
            amount: Math.round(regData.grandTotal * 100),
            currency: 'INR',
            receipt: `receipt_${savedReg._id}`,
            notes: { registration_id: savedReg._id.toString() }
        });
        
        savedReg.orderId = order.id;
        await savedReg.save();
        res.json({ ...order, registrationId: savedReg._id });
    } catch (err) { res.status(500).json({ error: 'Order creation failed' }); }
});

// Verify Payment (Payment Gateway Integration)
app.post('/verify-payment', async (req, res) => {
    const { paymentId, orderId, registrationId } = req.body;
    try {
        const reg = await Registration.findById(registrationId);
        if (!reg) return res.status(404).json({ error: 'Not found' });
        reg.paymentId = paymentId;
        reg.paymentStatus = 'successful';
        reg.orderId = orderId;
        await reg.save();
        res.json({ status: 'success' });
    } catch (err) { res.status(500).json({ error: 'Verification failed' }); }
});

// Admin: Get Data
app.get('/api/registrations', authenticateToken, async (req, res) => {
    try {
        const data = await Registration.find({ paymentStatus: 'successful' }).sort({ createdAt: -1 });
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Fetch failed' }); }
});

// Admin: Bulk PDF List Report (TABULAR & EVENT-WISE) - NO CONTACT INFO
app.get('/api/registrations/pdf', authenticateToken, async (req, res) => {
    try {
        const data = await Registration.find({ paymentStatus: 'successful' }).lean();
        if (data.length === 0) return res.status(404).send('No data');

        // Layout: Landscape A4 to fit table columns
        const doc = new PDFDocument({ size: 'A4', margin: 30, layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="Event_Attendance_List.pdf"');
        doc.pipe(res);

        // 1. Process Data: Group by Event
        const events = {};
        data.forEach(reg => {
            reg.teams.forEach(team => {
                const evt = team.eventName || 'General';
                if (!events[evt]) events[evt] = [];
                team.members.forEach(m => {
                    events[evt].push({
                        name: m.name,
                        team: team.teamName,
                        org: reg.organization.name, // Only Organization Name
                    });
                });
            });
        });

        // 2. Draw Tables
        let isFirstPage = true;
        for (const [eventName, participants] of Object.entries(events)) {
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;

            // Event Header
            doc.fillColor('#1e293b').fontSize(18).font('Helvetica-Bold').text(`Event: ${eventName.toUpperCase()}`, { underline: true });
            doc.fontSize(10).font('Helvetica').text(`Total Participants: ${participants.length}`);
            doc.moveDown();

            // Table Settings
            let currentY = doc.y;
            const itemHeight = 25;
            
            // Re-calculated Column Positions (Wider columns since contact is gone)
            // Total width ~780
            const colX = { sno: 30, name: 70, team: 250, org: 430, sig: 610 };

            // Header Row
            const drawHeader = (y) => {
                doc.rect(30, y, 750, itemHeight).fill('#cbd5e1'); // Gray Header Background
                doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
                doc.text('S.No', colX.sno + 5, y + 8);
                doc.text('Participant Name', colX.name + 5, y + 8);
                doc.text('Team Name', colX.team + 5, y + 8);
                doc.text('Organization', colX.org + 5, y + 8);
                doc.text('Signature', colX.sig + 5, y + 8);
            };

            drawHeader(currentY);
            currentY += itemHeight;

            // Rows
            doc.font('Helvetica').fontSize(9);
            
            participants.forEach((p, idx) => {
                // Handle Page Break
                if (currentY > doc.page.height - 50) {
                    doc.addPage();
                    currentY = 40;
                    drawHeader(currentY);
                    currentY += itemHeight;
                    doc.font('Helvetica').fontSize(9);
                }

                // Row Background (Alternating)
                if (idx % 2 === 0) doc.rect(30, currentY, 750, itemHeight).fill('#f8fafc');
                else doc.rect(30, currentY, 750, itemHeight).fill('#ffffff');

                // Row Borders
                doc.rect(30, currentY, 750, itemHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

                // Row Content
                doc.fillColor('#333');
                doc.text(idx + 1, colX.sno + 5, currentY + 8);
                doc.text(p.name, colX.name + 5, currentY + 8, { width: 170, ellipsis: true });
                doc.text(p.team, colX.team + 5, currentY + 8, { width: 170, ellipsis: true });
                doc.text(p.org, colX.org + 5, currentY + 8, { width: 170, ellipsis: true });
                // Signature column is left blank intentionally for manual signing
                
                currentY += itemHeight;
            });
        }
        
        doc.end();
    } catch (err) { res.status(500).json({ error: 'PDF Error' }); }
});

// Single Designer Certificate
app.get('/api/registrations/certificate/:regId/:teamIndex/:memberIndex', authenticateToken, async (req, res) => {
    try {
        const { regId, teamIndex, memberIndex } = req.params;
        const reg = await Registration.findById(regId).lean();
        if (!reg || !reg.teams[teamIndex] || !reg.teams[teamIndex].members[memberIndex]) return res.status(404).send('Not found');

        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);
        drawEnhancedCertificate(doc, reg, reg.teams[teamIndex], reg.teams[teamIndex].members[memberIndex]);
        doc.end();
    } catch (err) { res.status(500).send('Error'); }
});

// --- 7. START ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});