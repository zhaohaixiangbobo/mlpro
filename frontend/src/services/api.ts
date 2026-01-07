import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 5000, // 5 seconds timeout
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth APIs
export const login = async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/auth/token', formData);
    return response.data;
};

export const register = async (username: string, password: string) => {
    const response = await api.post('/auth/register', { username, password });
    return response.data;
};

export const getMe = async () => {
    const response = await api.get('/auth/me');
    return response.data;
};

export const uploadData = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/data/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getPreview = async (filename: string, page: number = 1, limit: number = 20) => {
  const response = await api.get(`/data/preview/${filename}`, {
    params: { page, limit }
  });
  return response.data;
};

export const listFiles = async () => {
  const response = await api.get('/data/list');
  return response.data;
};

export const splitData = async (payload: {
    filename: string;
    train_ratio: number;
    test_ratio: number;
    val_ratio: number;
    strategy: string;
    stratify_col?: string;
}) => {
    const response = await api.post('/data/split', payload);
    return response.data;
};

export const setLabel = async (filename: string, label_column: string | null) => {
    const response = await api.post('/data/label', { filename, label_column });
    return response.data;
};

export const deleteFile = async (filename: string) => {
    const response = await api.delete(`/data/files/${filename}`);
    return response.data;
};

export const downloadFile = async (filename: string) => {
    const response = await api.get(`/data/download/${filename}`, {
        responseType: 'blob'
    });
    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

export const saveWorkflow = async (name: string, nodes: any[], edges: any[]) => {
    const response = await api.post('/workflow/save', { name, nodes, edges });
    return response.data;
};

export const listWorkflows = async () => {
    const response = await api.get('/workflow/list');
    return response.data;
};

export const loadWorkflow = async (name: string) => {
    const response = await api.get(`/workflow/${name}`);
    return response.data;
};

export const deleteWorkflow = async (name: string) => {
    const response = await api.delete(`/workflow/${encodeURIComponent(name)}`);
    return response.data;
};

export const predict = async (payload: {
    node_id: string;
    data_file: string;
    preprocessing: any[];
    algorithm_label?: string;
}) => {
    const response = await api.post('/workflow/predict', payload);
    return response.data;
};

export const downloadPrediction = async (filename: string) => {
    const response = await api.get(`/workflow/download/prediction/${filename}`, {
        responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

export const getPCAData = async (filename: string, label_column?: string) => {
    const response = await api.post('/data/pca', { filename, label_column });
    return response.data;
};

export const exportReport = async (workflowName: string, format: 'docx' | 'pdf') => {
    const response = await api.post('/report/export', { workflow_name: workflowName, format }, {
        responseType: 'blob'
    });
    
    // Get filename from header or default
    let filename = `${workflowName}_report.${format}`;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
            filename = matches[1].replace(/['"]/g, '');
        }
    }

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

export default api;
