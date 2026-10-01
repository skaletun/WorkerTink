import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import UpdateGate from './UpdateGate';
import PullToRefresh from './PullToRefresh';
import './ui.css';
createRoot(document.getElementById('root')!).render(<StrictMode><UpdateGate><PullToRefresh><App/></PullToRefresh></UpdateGate></StrictMode>);