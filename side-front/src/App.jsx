import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import SettingsPage from './SettingsPage';
import MainPage from './MainPage';
import Switch from '@mui/material/Switch';
import { useMemo, useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, useMediaQuery } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CircularProgress from '@mui/material/CircularProgress';
import defaultSettings from './assets/defaultSettings.json';

function Menu({ mode, onToggleMode }) {
  const location = useLocation();
  return (
    <Stack direction="row" spacing={2} sx={{ p: 2, bgcolor: 'background.default', alignItems: 'center', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100 }}>
      <Button component={Link} to="/" variant={location.pathname === '/' ? 'contained' : 'outlined'} color="primary">메인</Button>
      <Button component={Link} to="/settings" variant={location.pathname === '/settings' ? 'contained' : 'outlined'} color="primary">설정</Button>
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={1} alignItems="center">
        <Brightness7Icon sx={{ color: mode === 'light' ? '#fbc02d' : '#888' }} />
        <Switch checked={mode === 'dark'} onChange={onToggleMode} color="default" />
        <Brightness4Icon sx={{ color: mode === 'dark' ? '#90caf9' : '#888' }} />
      </Stack>
    </Stack>
  );
}

function App() {
  // 시스템 다크모드 감지
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState(() => prefersDarkMode ? 'dark' : 'light');

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: { default: '#23272f', paper: '#2d323c' },
            text: { primary: '#f5f6fa', secondary: '#b0b8c1' },
          }
        : {
            background: { default: '#f5f6fa', paper: '#fff' },
            text: { primary: '#23272f', secondary: '#444a58' },
          }),
    },
  }), [mode]);

  const handleToggleMode = () => setMode(prev => (prev === 'dark' ? 'light' : 'dark'));

  // 전역 데이터 관리
  // 기본값 세팅
  const DEFAULT_SETTINGS = useMemo(() => defaultSettings, []);
  const [settings, setSettings] = useState(null);
  const [shopInfos, setShopInfos] = useState({});
  const [menuLists, setMenuLists] = useState({});
  const [loading, setLoading] = useState(true);

  // 최초 1회만 fetch
  useEffect(() => {
    if (settings) return;
    setLoading(true);
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const newSettings = data && Object.keys(data).length > 0 ? data : DEFAULT_SETTINGS;
        setSettings(newSettings);
        if (newSettings.checkboxes) {
          Promise.all(
            newSettings.checkboxes.map(cb =>
              fetch(`/api/${cb.code}/get-shop-info`)
                .then(res => res.json())
                .then(res => ({
                  code: cb.code,
                  shopInfo: res.data?.shopInfo,
                  menuList: res.data?.menuList,
                }))
            )
          ).then(results => {
            const shopInfoObj = {};
            const menuListObj = {};
            results.forEach(({ code, shopInfo, menuList }) => {
              shopInfoObj[code] = shopInfo;
              menuListObj[code] = menuList;
            });
            setShopInfos(shopInfoObj);
            setMenuLists(menuListObj);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
  }, [settings, DEFAULT_SETTINGS]);

  // 저장 함수 (SettingsPage에서 호출)
  const handleSaveSettings = async (payload) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        // 저장 성공 시 App의 상태도 즉시 갱신
        setSettings(payload);
        // shopInfos, menuLists는 필요시 재요청하거나, 그대로 둘 수 있음
        alert(data.message);
      } else {
        alert('저장 실패: ' + (data.error || data.message || ''));
      }
    } catch (e) {
      console.error(e);
      alert('저장 중 오류 발생');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Menu mode={mode} onToggleMode={handleToggleMode} />
        <Box sx={{ pt: '64px' }}>
          <Routes>
            <Route path="/" element={<MainPage settings={settings} shopInfos={shopInfos} menuLists={menuLists} loading={loading} />} />
            <Route path="/settings" element={<SettingsPage settings={settings} shopInfos={shopInfos} menuLists={menuLists} loading={loading} onSaveSettings={handleSaveSettings} />} />
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
