
import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Card, Typography, Layout, Tabs } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { register } from '../services/api';

const { Title } = Typography;

const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('login');

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            if (activeTab === 'login') {
                await login(values.username, values.password);
                navigate('/');
            } else {
                await register(values.username, values.password);
                // Auto login after register or switch tab?
                // For simplicity, just notify and switch to login
                alert("注册成功，请登录");
                setActiveTab('login');
            }
        } catch (error) {
            // Error handled in AuthContext or here
        } finally {
            setLoading(false);
        }
    };

    // Dark Sci-Fi Theme Styles
    const pageStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: 'url(/a3.png) no-repeat center center fixed',
        backgroundSize: 'cover',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    };

    const particleStyle: React.CSSProperties = {
        position: 'absolute',
        width: '100%',
        height: '100%',
        // backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', // Removed for image bg
        // backgroundSize: '30px 30px',
        zIndex: 0,
    };

    const cardStyle: React.CSSProperties = {
        width: 400,
        background: 'rgba(255, 255, 255, 0.75)', // White semi-transparent
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
        zIndex: 1,
    };

    const inputStyle = {
        background: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid #d9d9d9',
        color: '#333',
    };

    return (
        <Layout style={pageStyle}>
            <div style={particleStyle} />
            <Card style={cardStyle} bordered={false}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={2} style={{ color: '#333', marginBottom: 8 }}>MLPro AI</Title>
                    <Typography.Text style={{ color: 'rgba(0,0,0,0.6)' }}>
                        智能算法平台 · 开启未来
                    </Typography.Text>
                </div>

                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab} 
                    centered
                    items={[
                        { label: '登录', key: 'login' },
                        { label: '注册', key: 'register' }
                    ]}
                    tabBarStyle={{ color: '#333' }}
                />

                <Form
                    name="login_form"
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                    size="large"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: '请输入用户名' }]}
                    >
                        <Input 
                            prefix={<UserOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />} 
                            placeholder="用户名" 
                            style={inputStyle}
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />} 
                            placeholder="密码"
                            style={inputStyle}
                        />
                    </Form.Item>

                    {activeTab === 'login' && (
                        <Form.Item name="remember" valuePropName="checked">
                            <Checkbox style={{ color: 'rgba(0,0,0,0.7)' }}>记住我</Checkbox>
                        </Form.Item>
                    )}

                    <Form.Item>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            loading={loading}
                            block
                            style={{ 
                                background: 'linear-gradient(90deg, #00d2ff 0%, #3a7bd5 100%)',
                                border: 'none',
                                height: 48,
                                fontSize: 16,
                                fontWeight: 'bold'
                            }}
                        >
                            {activeTab === 'login' ? '登 录' : '注 册'}
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Layout>
    );
};

export default Login;
