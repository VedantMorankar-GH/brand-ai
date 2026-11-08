import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken } from '../data/api.js';
import { initializeWorkspaceSync } from '../data/workspaceSync.js';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(()=>{try{return getToken()?JSON.parse(localStorage.getItem('bg_user')||'null'):null}catch{return null}});
 const [loading,setLoading]=useState(Boolean(getToken()));
 useEffect(()=>{let active=true;if(getToken())api('/auth/me').then(async ({user})=>{if(active){setUser(user);localStorage.setItem('bg_user',JSON.stringify(user));await initializeWorkspaceSync();}}).catch(()=>{localStorage.removeItem('bg_token');localStorage.removeItem('bg_user');if(active)setUser(null)}).finally(()=>active&&setLoading(false));return()=>{active=false}},[]);
 const login=async(email,password)=>{const data=await api('/auth/login',{method:'POST',body:{email,password}});localStorage.setItem('bg_token',data.token);localStorage.setItem('bg_user',JSON.stringify(data.user));setUser(data.user);await initializeWorkspaceSync();return true};
 const register=async(data)=>{const result=await api('/auth/register',{method:'POST',body:data});localStorage.setItem('bg_token',result.token);localStorage.setItem('bg_user',JSON.stringify(result.user));setUser(result.user);await initializeWorkspaceSync();return true};
 const logout=()=>{localStorage.removeItem('bg_token');localStorage.removeItem('bg_user');setUser(null)};
 const value=useMemo(()=>({user,login,register,logout,loading}),[user,loading]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
