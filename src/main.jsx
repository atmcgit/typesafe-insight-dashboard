import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App.jsx';
import './styles.css';

const theme = createTheme({ palette: { mode: 'dark', background: { default: '#0f172a', paper: '#1b2336' } }, typography: { fontFamily: 'IBM Plex Sans, sans-serif' } });

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><ThemeProvider theme={theme}><CssBaseline /><App /></ThemeProvider></React.StrictMode>);
