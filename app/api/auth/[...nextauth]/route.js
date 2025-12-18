import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e senha são obrigatórios');
        }
        
        if (credentials.email === 'demo@dama.com' && credentials.password === 'demo123') {
          return {
            id: 'demo-user',
            email: 'demo@dama.com',
            name: 'Usuário Demo',
            plano: 'premium'
          };
        }
        
        throw new Error('Credenciais inválidas');
      }
    })
  ],
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.plano = user.plano || 'free';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.plano = token.plano;
      }
      return session;
    }
  },
  
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET || 'dama-secret-2024',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
