import mongoose from 'mongoose';
const workspaceSchema = new mongoose.Schema({
  organization: { type: String, default: 'default', lowercase: true, trim: true, unique: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  version: { type: Number, default: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export const WorkspaceState = mongoose.models.WorkspaceState || mongoose.model('WorkspaceState', workspaceSchema);
