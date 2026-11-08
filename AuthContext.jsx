import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getUsers, updateUser, addUser } from '../data/governanceStore.js';
const AuthContext = createContext(null);
export function AuthProvider({children}) {
 const [user,setUser] = useState(()=>{try{const saved=JSON.parse(localStorage.getItem('bg_session'));if(!saved)return null;const account=getUsers().find(u=>u.email.toLowerCase()===String(saved.email||'').toLowerCase());if(!account||account.status!=='Active')return null;const {password:_,...safe}=account;return safe;}catch{return null}});
 useEffect(()=>{user?localStorage.setItem('bg_session',JSON.stringify(user)):localStorage.removeItem('bg_session')},[user]);
 const login=(email,password)=>{const found=getUsers().find(u=>u.email.toLowerCase()===email.toLowerCase()&&u.password===password&&u.status==='Active');if(!found)return false;const updated=updateUser(found.id,{lastActivity:new Date().toISOString()},found);const {password:_,...safe}=updated;setUser(safe);return true};
 const register=(data)=>{const safe=addUser({name:data.name,email:data.email,password:data.password,role:'Creator',department:'Unassigned'});const {password:_,...session}=safe;setUser(session);};
 const logout=()=>setUser(null);
 const value=useMemo(()=>({user,login,register,logout}),[user]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
