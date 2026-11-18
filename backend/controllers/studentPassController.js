import { findCurrentStudentPass } from '../models/StudentPass.js';

export async function getCurrentStudentPass(req, res, next) {
  try {
    const pass = await findCurrentStudentPass(req.auth.passengerId);
    return res.json({
      pass: pass ? { ...pass, qrValue: `bmtc://student-pass/${pass.publicId}` } : null,
    });
  } catch (error) {
    return next(error);
  }
}
