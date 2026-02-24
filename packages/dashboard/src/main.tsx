import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(<RouterProvider router={router} />);
