import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
export async function protect(req,res,next){try{const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):null;if(!token)return res.status(401).json({message:'Sign in to continue.'});const payload=jwt.verify(token,process.env.JWT_SECRET);const user=await User.findById(payload.sub);if(!user||user.status!=='Active')return res.status(401).json({message:'Your session is no longer valid.'});req.user=user;next();}catch{return res.status(401).json({message:'Invalid or expired session.'});}}
export const allowRoles=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({message:'You do not have permission to perform this action.'});
