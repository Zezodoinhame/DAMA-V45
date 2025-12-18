'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há usuário salvo no localStorage
    const savedUser = localStorage.getItem('dama_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password })
    });
    
    const data = await res.json();
    
    if (data.success) {
      setUser(data.user);
      localStorage.setItem('dama_user', JSON.stringify(data.user));
      return { success: true };
    }
    
    return { success: false, error: data.error };
  };

  const cadastro = async (nome, email, password) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cadastro', nome, email, password })
    });
    
    const data = await res.json();
    
    if (data.success) {
      setUser(data.user);
      localStorage.setItem('dama_user', JSON.stringify(data.user));
      return { success: true };
    }
    
    return { success: false, error: data.error };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('dama_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, cadastro, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
