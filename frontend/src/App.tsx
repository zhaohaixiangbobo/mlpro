import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import DataImport from './pages/DataImport';
import Workflow from './pages/Workflow';
import Dashboard from './pages/Dashboard';
import Prediction from './pages/Prediction';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';
import AlgorithmIntro from './pages/AlgorithmIntro';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) {
        return <div>Loading...</div>; // Or a proper loading spinner
    }
    
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    
    return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/data" replace />} />
            <Route path="data" element={<DataImport />} />
            <Route path="workflow" element={<Workflow />} />
            <Route path="prediction" element={<Prediction />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="algorithms" element={<AlgorithmIntro />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
