import mongoose, { Schema } from 'mongoose';

const loginEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true, lowercase: true, trim: true },
    action: {
      type: String,
      required: true,
      enum: ['register', 'login', 'logout', 'failed_login'],
    },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginEventSchema.index({ email: 1, createdAt: -1 });

export const LoginEventModel =
  mongoose.models.LoginEvent || mongoose.model('LoginEvent', loginEventSchema);
