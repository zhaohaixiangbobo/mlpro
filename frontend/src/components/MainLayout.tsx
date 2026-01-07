import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Modal } from 'antd';
import { 
  UploadOutlined, 
  NodeIndexOutlined, 
  DashboardOutlined,
  UserOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  ReadOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isFeedbackModalVisible, setIsFeedbackModalVisible] = useState(false);

  const handleMenuClick = (e: { key: string }) => {
      if (e.key === 'logout') {
          logout();
      } else if (e.key === 'feedback') {
          setIsFeedbackModalVisible(true);
      }
  };

  const userMenu = {
      items: [
          {
              key: 'feedback',
              label: '问题反馈',
              icon: <QuestionCircleOutlined />,
          },
          {
              key: 'logout',
              label: '退出登录',
              icon: <LogoutOutlined />,
          }
      ],
      onClick: handleMenuClick
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', color: 'white', lineHeight: '32px' }}>
          MLPro
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={[
            {
              key: '/data',
              icon: <UploadOutlined />,
              label: '数据管理',
              onClick: () => navigate('/data'),
            },
            {
              key: '/workflow',
              icon: <NodeIndexOutlined />,
              label: '工作流',
              onClick: () => navigate('/workflow'),
            },
            {
              key: '/prediction',
              icon: <RobotOutlined />,
              label: '模型预测',
              onClick: () => navigate('/prediction'),
            },
            {
              key: '/dashboard',
              icon: <DashboardOutlined />,
              label: '可视化结果',
              onClick: () => navigate('/dashboard'),
            },
            {
              key: '/algorithms',
              icon: <ReadOutlined />,
              label: '算法介绍',
              onClick: () => navigate('/algorithms'),
            },
          ]}
        />
      </Sider>
      <Layout className="site-layout">
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Dropdown menu={userMenu}>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
                    <span>{user?.username}</span>
                </div>
            </Dropdown>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, minHeight: 'calc(100vh - 112px)', background: '#fff' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>

      <Modal
          title="问题反馈"
          open={isFeedbackModalVisible}
          onOk={() => setIsFeedbackModalVisible(false)}
          onCancel={() => setIsFeedbackModalVisible(false)}
          footer={[
              <Button key="ok" type="primary" onClick={() => setIsFeedbackModalVisible(false)}>
                  知道了
              </Button>
          ]}
      >
          <p>如果您在使用过程中遇到任何问题，请联系信息中心：</p>
          <p><strong>联系人：</strong> 赵海翔</p>
          <p><strong>联系电话：</strong> 166xxx8957</p>
      </Modal>
    </Layout>
  );
};

export default MainLayout;
