import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/caveat/latin-600.css';
import App from './App';
import './styles.css';
document.documentElement.classList.add('js');
createRoot(document.getElementById('root')!).render(<App />);
