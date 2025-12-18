'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const result = await login(email, password);

    if (result.success) {
      router.push('/');
    } else {
      setErrorMsg(result.error || 'Email ou senha incorretos');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-2xl mb-4">
            <span className="text-3xl font-black text-white">D</span>
          </div>
          <h1 className="text-2xl font-bold text-white">DAMA Investimentos</h1>
          <p className="text-slate-400 mt-2">Faça login para acessar sua conta</p>
        </div>

        <div className="bg-[#1a1a28] rounded-2xl p-8 border border-[#2d2d3d]">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d0d14] border border-[#2d2d3d] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d0d14] border border-[#2d2d3d] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <p className="text-cyan-400 text-sm font-medium mb-1">🎯 Acesso Demo</p>
            <p className="text-slate-400 text-xs">Email: demo@dama.com | Senha: demo123</p>
          </div>
        </div>

        <p className="text-center mt-6 text-slate-400">
          Não tem uma conta?{' '}
          <Link href="/cadastro" className="text-cyan-400 hover:underline">Cadastre-se grátis</Link>
        </p>

        <p className="text-center mt-4">
          <Link href="/" className="text-slate-500 hover:text-white text-sm">← Voltar para a plataforma</Link>
        </p>
      </div>
    </div>
  );
}
