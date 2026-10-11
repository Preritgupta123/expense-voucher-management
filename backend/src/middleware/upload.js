const multer = require('multer');
const path = require('path');
const fs = require('fs');

// backend/uploads/signatures  (created automatically if missing)
const signatureDir = path.join(__dirname, '..', '..', 'uploads', 'signatures');
fs.mkdirSync(signatureDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, signatureDir),
  filename: (req, file, cb) => {
    // We choose the extension ourselves from the checked mimetype,
    // never trusting the name the user's file came with.
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (['image/png', 'image/jpeg'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG or JPG images are allowed'));
  },
});

// Wraps multer so upload problems become clean 400 responses
// instead of falling into the generic 500 error handler.
function uploadSignature(req, res, next) {
  upload.single('signature')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller' : err.message;
      return res.status(400).json({ message });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'Signature image is required (form field name: signature)' });
    }
    next();
  });
}

module.exports = { uploadSignature };