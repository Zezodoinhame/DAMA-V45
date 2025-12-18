import './globals.css';
import Providers from './providers';

export const metadata = { 
  title: 'DAMA Investimentos', 
  description: 'Plataforma inteligente para análise de investimentos',
  icons: { icon: '/favicon.ico' }
};

export default function RootLayout({ children }) { 
  return (
    <html lang="pt-BR">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  ); 
}
