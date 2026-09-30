import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import UpdateGate from './UpdateGate';
import './styles.css';
import './design.css';
import './v7.css';
createRoot(document.getElementById('root')!).render(<StrictMode><UpdateGate><App/></UpdateGate></StrictMode>);