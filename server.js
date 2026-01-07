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
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin-july:Ansh2204@m0.nwuak9s.mongodb.net/?appName=M0";
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key_change_me';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag';
const RAZORPAY_SECRET_KEY = process.env.RAZORPAY_SECRET_KEY || 'CeJqYp42Qk3rlEFj6u7DvZSJ';

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

// --- 5. HELPER: VINTAGE 1950s ACADEMIC CERTIFICATE (COMPLEX BORDER EDITION) ---
const drawEnhancedCertificate = (doc, reg, team, student) => {
    const width = doc.page.width;
    const height = doc.page.height;

    // --- VINTAGE PALETTE ---
    const c = {
        bg: '#f0f0eb',       // Aged paper
        ink: '#2c2c2c',      // Faded black
        border: '#4a4a4a',   // Dark gray
        accent: '#666666',   // Medium gray
    };

    // 1. Background
    doc.rect(0, 0, width, height).fill(c.bg);

    // 2. Complex Borders (Layered)
    const m = 30; // Outer margin

    // Layer A: Heavy Outer Frame
    doc.lineWidth(4).strokeColor(c.border)
       .rect(m, m, width - m*2, height - m*2).stroke();
       
    // Layer B: Thin Middle Gap Line
    const m2 = m + 6;
    doc.lineWidth(1).strokeColor(c.border)
       .rect(m2, m2, width - m2*2, height - m2*2).stroke();

    // Layer C: Ornate Inner Frame with Scrollwork
    const innerM = m + 18;
    doc.lineWidth(1.5).strokeColor(c.ink)
       .rect(innerM, innerM, width - innerM*2, height - innerM*2).stroke();

    // Complex Corner Ornamentation
    const drawComplexCorner = (x, y, rotate) => {
        doc.save().translate(x, y).rotate(rotate);
        doc.strokeColor(c.ink);
        
        // Structural Bracket
        doc.lineWidth(2).path('M 0 0 L 55 0').stroke(); // Horizontal
        doc.lineWidth(2).path('M 0 0 L 0 55').stroke(); // Vertical
        
        // Inner Scroll Curve
        doc.lineWidth(1);
        doc.path('M 5 5 Q 35 5 35 35 T 65 65').stroke();
        
        // Filigree Details (Leaves/Flourishes)
        doc.lineWidth(0.5);
        // Top side flourishes
        doc.path('M 15 5 Q 20 -5 25 5').stroke();
        doc.path('M 35 5 Q 40 -5 45 5').stroke();
        // Left side flourishes
        doc.path('M 5 15 Q -5 20 5 25').stroke();
        doc.path('M 5 35 Q -5 40 5 45').stroke();
        
        // Corner Dot Accents
        doc.circle(60, 0, 2.5).fill(c.ink); // Top end
        doc.circle(0, 60, 2.5).fill(c.ink); // Left end
        doc.circle(65, 65, 2).fill(c.ink); // Curve end
        
        doc.restore();
    };

    // Draw corners
    drawComplexCorner(innerM, innerM, 0);          // TL
    drawComplexCorner(width - innerM, innerM, 90);  // TR
    drawComplexCorner(width - innerM, height - innerM, 180); // BR
    drawComplexCorner(innerM, height - innerM, 270); // BL


    // --- 3. TEXT CONTENT (Tightened Spacing) ---
    // Moved start Y slightly up and reduced increments by ~10%
    
    let cursorY = 85; 

    // Header
    doc.font('Times-Roman').fontSize(14).fillColor(c.accent)
       .text('THE ORGANIZING COMMITTEE OF', 0, cursorY, { align: 'center', characterSpacing: 2 });
    
    cursorY += 24; // +5%
    doc.font('Times-Bold').fontSize(30).fillColor(c.ink)
       .text('KAIROS 2026', 0, cursorY, { align: 'center', characterSpacing: 5 });

    // Intro
    cursorY += 42; // +5%
    doc.font('Times-Italic').fontSize(12).fillColor(c.accent)
       .text('Hereby confers upon', 0, cursorY, { align: 'center' });

    // Recipient Name
    cursorY += 32; // +5%
    doc.font('Times-BoldItalic').fontSize(40).fillColor(c.ink)
       .text(student.name, 0, cursorY, { align: 'center' });
    
    // Separator Line
    cursorY += 58; // +5%
    doc.lineWidth(0.5).strokeColor(c.ink)
       .moveTo(width/2 - 120, cursorY).lineTo(width/2 + 120, cursorY).stroke();

    // Award Body
    cursorY += 27; // +5%
    doc.font('Times-Roman').fontSize(18).fillColor(c.ink)
       .text('The Certificate of Excellence', 0, cursorY, { align: 'center', characterSpacing: 1 });

    cursorY += 32; // +5%
    doc.font('Times-Italic').fontSize(12).fillColor(c.accent)
       .text('in recognition of outstanding participation and merit in the field of', 0, cursorY, { align: 'center' });

    // Event Name
    cursorY += 37; // +5%
    doc.font('Times-Bold').fontSize(24).fillColor(c.ink)
       .text(team.eventName.toUpperCase(), 0, cursorY, { align: 'center' });

    // Team/Org Details
    cursorY += 34; // +5%
    doc.font('Times-Roman').fontSize(11).fillColor(c.accent)
       .text(`Awarded to the representative of Team "${team.teamName}"`, 0, cursorY, { align: 'center' });
    
    cursorY += 15; // +5%
    const orgName = reg.organization ? reg.organization.name : 'Unknown Organization';
    doc.text(`Organization: ${orgName}`, 0, cursorY, { align: 'center' });


    // --- 4. BOTTOM SECTION (Signatures Closer) ---

    // Signatures (Moved UP to reduce gap)
    // Previous was height - 70. Moving to height - 85 closes gap by 15px + text saved space
    const sigY = height - 85;
    const colW = 160;
    
    const x1 = innerM + 40;
    const x2 = (width/2) - (colW/2); 
    const x3 = width - innerM - colW - 40;

    // Helper to draw signature block
    const drawSig = (x, title) => {
        doc.lineWidth(0.5).strokeColor(c.ink).opacity(0.7)
           .moveTo(x, sigY).lineTo(x + colW, sigY).stroke();
        doc.font('Times-Roman').fontSize(10).fillColor(c.ink).opacity(1)
           .text(title, x, sigY + 8, { width: colW, align: 'center' });
        doc.font('Times-Italic').fontSize(8).fillColor(c.accent)
           .text('Authorized Signature', x, sigY + 20, { width: colW, align: 'center' });
    };

    // Signatures
    drawSig(x1, 'FOUNDER');
    drawSig(x2, 'FOUNDER');
    drawSig(x3, 'EVENT HEAD');

    // Date Footer Removed as requested
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

// Admin: Bulk PDF List Report (PORTRAIT & SIMPLE BORDER)
app.get('/api/registrations/pdf', authenticateToken, async (req, res) => {
    try {
        const data = await Registration.find({ paymentStatus: 'successful' }).lean();
        if (data.length === 0) return res.status(404).send('No data');

        // Layout: Portrait A4 (Default) - Width ~595pt. Margin 30. Usable ~535.
        const doc = new PDFDocument({ size: 'A4', margin: 30 }); 
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
                        org: reg.organization.name,
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
            doc.fillColor('#1e293b').fontSize(16).font('Helvetica-Bold').text(`Event: ${eventName.toUpperCase()}`, { underline: true });
            doc.fontSize(10).font('Helvetica').text(`Total Participants: ${participants.length}`);
            doc.moveDown();

            // Table Settings for Portrait
            let currentY = doc.y;
            const itemHeight = 30; // Slightly taller for readability
            const tableWidth = 535; // 595 (A4 Width) - 60 (Margins)
            
            // Re-calculated Column X Positions for Portrait
            const colX = { sno: 30, name: 65, team: 195, org: 325, sig: 455 };

            // Header Row (Simple Bordered)
            const drawHeader = (y) => {
                // Outer Box
                doc.rect(30, y, tableWidth, itemHeight).strokeColor('#000').lineWidth(1).stroke();
                
                // Vertical Separators
                doc.moveTo(colX.name, y).lineTo(colX.name, y + itemHeight).stroke();
                doc.moveTo(colX.team, y).lineTo(colX.team, y + itemHeight).stroke();
                doc.moveTo(colX.org, y).lineTo(colX.org, y + itemHeight).stroke();
                doc.moveTo(colX.sig, y).lineTo(colX.sig, y + itemHeight).stroke();

                // Header Text
                doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
                doc.text('S.No', colX.sno + 5, y + 10);
                doc.text('Name', colX.name + 5, y + 10);
                doc.text('Team', colX.team + 5, y + 10);
                doc.text('Organization', colX.org + 5, y + 10);
                doc.text('Sign', colX.sig + 5, y + 10);
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

                // Row Outer Box (Simple Border)
                doc.rect(30, currentY, tableWidth, itemHeight).strokeColor('#000').lineWidth(1).stroke();

                // Row Vertical Separators
                doc.moveTo(colX.name, currentY).lineTo(colX.name, currentY + itemHeight).stroke();
                doc.moveTo(colX.team, currentY).lineTo(colX.team, currentY + itemHeight).stroke();
                doc.moveTo(colX.org, currentY).lineTo(colX.org, currentY + itemHeight).stroke();
                doc.moveTo(colX.sig, currentY).lineTo(colX.sig, currentY + itemHeight).stroke();

                // Content
                doc.fillColor('#000');
                doc.text(idx + 1, colX.sno + 5, currentY + 10);
                doc.text(p.name, colX.name + 5, currentY + 10, { width: 120, ellipsis: true });
                doc.text(p.team, colX.team + 5, currentY + 10, { width: 120, ellipsis: true });
                doc.text(p.org, colX.org + 5, currentY + 10, { width: 120, ellipsis: true });
                // Signature column empty
                
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