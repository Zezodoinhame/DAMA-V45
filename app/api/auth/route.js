import { NextResponse } from 'next/server';

// Simples API de autenticação (sem NextAuth)
const USERS = {
  'demo@dama.com': { id: 'demo', nome: 'Usuário Demo', senha: 'demo123', plano: 'premium' }
};

export async function POST(request) {
  const { action, email, password, nome } = await request.json();
  
  if (action === 'login') {
    const user = USERS[email];
    if (user && user.senha === password) {
      return NextResponse.json({ 
        success: true, 
        user: { id: user.id, email, nome: user.nome, plano: user.plano }
      });
    }
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
  }
  
  if (action === 'cadastro') {
    if (USERS[email]) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 });
    }
    // Em produção, salvaria no banco
    return NextResponse.json({ 
      success: true, 
      user: { id: `user-${Date.now()}`, email, nome, plano: 'free' }
    });
  }
  
  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
