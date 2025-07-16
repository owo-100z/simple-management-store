import Box from '@mui/material/Box';
import { Typography, useTheme, Button, Stack, TextField, CircularProgress, Grid } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useState } from 'react';

function getNowDateTimeLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  const pad = n => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function addMinutesToDateTimeLocal(dtStr, minutes) {
  const date = dtStr ? new Date(dtStr) : new Date();
  date.setMinutes(date.getMinutes() + minutes);
  date.setSeconds(0, 0);
  const pad = n => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function MainPage({ settings, menuLists, loading }) {
  const theme = useTheme();
  const [dateTime, setDateTime] = useState(getNowDateTimeLocal());
  // API 로딩 상태 관리
  const [apiLoading, setApiLoading] = useState({});
  // 체크박스별 get-shop-info 로딩 상태 (settings, menuLists가 있으면 모두 완료로 간주)
  const menuLoading = (settings?.checkboxes || []).reduce((acc, cb) => {
    acc[cb.code] = !menuLists?.[cb.code];
    return acc;
  }, {});

  // 품절/품절해제 버튼 클릭 시 선택된 리스트를 각 code별로 세팅해서 API 호출
  const handleSoldOut = async (btn) => {
    try {
      // 로딩 상태 시작
      const loadingState = {};
      settings?.checkboxes?.forEach(cb => { loadingState[cb.code] = true; });
      setApiLoading(loadingState);

      const promises = settings?.checkboxes?.map(async (cb, idx) => {
        // 각 code별로 해당 버튼의 선택된 리스트 추출
        const selectedList = settings.selectedMap?.[idx]?.[btn] || [];

        const selectedMenuList = selectedList.filter(item => item._type === 'menu');
        const selectedOptionList = selectedList.filter(item => item._type === 'option');

        let menuList = [];
        let optionList = [];

        if (cb.code === 'baemin') {
          menuList = selectedMenuList.map((item) => {
            return item.menuId;
          });
          optionList = selectedOptionList.map((item) => {
            return item.optionId;
          });
        } else if (cb.code === 'coupang') {
          menuList = selectedMenuList.map((item) => {
            return item.dishId;
          });
          optionList = selectedOptionList.map((item) => {
            return item.optionItemId;
          });
        } else if (cb.code === 'ddangyo') {
          menuList = selectedMenuList;
          optionList = selectedOptionList;
        }

        try {
          const response = await fetch(`/api/${cb.code}/soldout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menuList, optionList }),
          });
          
          const responseData = await response.json();
          
          if (!response.ok || !responseData.success) {
            throw new Error(`API 호출 실패: ${cb.code}`);
          }
          
          return { success: true, code: cb.code, data: responseData };
        } catch (error) {
          return { success: false, code: cb.code, error: error.message };
        }
      });
      const results = await Promise.all(promises);
      console.log('품절 API 호출 결과:', results);
      
      // 성공/실패 개수 계산
      const successCount = results.filter(r => r.success).length;
      const failResults = results.filter(r => !r.success);
      const failCount = failResults.length;
      // 실패한 code의 label 추출
      const codeToLabel = Object.fromEntries((settings?.checkboxes || []).map(cb => [cb.code, cb.label]));
      const failLabels = failResults.map(r => codeToLabel[r.code]).filter(Boolean);
      
      if (failCount === 0) {
        alert('품절이 성공적으로 처리되었습니다.');
      } else if (successCount === 0) {
        alert('모든 품절 처리에 실패했습니다.');
      } else {
        alert(`품절 처리 결과: ${successCount}개 성공, ${failCount}개 실패 (실패: ${failLabels.join(', ')})`);
      }
    } catch (e) {
      // 에러 처리
      console.error('품절 처리 중 오류:', e);
    } finally {
      // 로딩 상태 종료
      setApiLoading({});
    }
  };

  const handleRelease = async (btn) => {
    try {
      // 로딩 상태 시작
      const loadingState = {};
      settings?.checkboxes?.forEach(cb => { loadingState[cb.code] = true; });
      setApiLoading(loadingState);

      const promises = settings?.checkboxes?.map(async (cb, idx) => {
        const selectedList = settings.selectedMap?.[idx]?.[btn] || [];

        const selectedMenuList = selectedList.filter(item => item._type === 'menu');
        const selectedOptionList = selectedList.filter(item => item._type === 'option');

        let menuList = [];
        let optionList = [];

        if (cb.code === 'baemin') {
          menuList = selectedMenuList.map((item) => {
            return item.menuId;
          });
          optionList = selectedOptionList.map((item) => {
            return item.optionId;
          });
        } else if (cb.code === 'coupang') {
          menuList = selectedMenuList.map((item) => {
            return item.dishId;
          });
          optionList = selectedOptionList.map((item) => {
            return item.optionItemId;
          });
        } else if (cb.code === 'ddangyo') {
          menuList = selectedMenuList;
          optionList = selectedOptionList;
        }

        try {
          const response = await fetch(`/api/${cb.code}/active`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menuList, optionList }),
          });
          
          const responseData = await response.json();
          
          if (!response.ok || !responseData.success) {
            throw new Error(`API 호출 실패: ${cb.code}`);
          }
          
          return { success: true, code: cb.code, data: responseData };
        } catch (error) {
          return { success: false, code: cb.code, error: error.message };
        }
      });
      const results = await Promise.all(promises);
      console.log('품절해제 API 호출 결과:', results);
      
      // 성공/실패 개수 계산
      const successCount = results.filter(r => r.success).length;
      const failResults = results.filter(r => !r.success);
      const failCount = failResults.length;
      // 실패한 code의 label 추출
      const codeToLabel = Object.fromEntries((settings?.checkboxes || []).map(cb => [cb.code, cb.label]));
      const failLabels = failResults.map(r => codeToLabel[r.code]).filter(Boolean);
      
      if (failCount === 0) {
        alert('품절해제가 성공적으로 처리되었습니다.');
      } else if (successCount === 0) {
        alert('모든 품절해제 처리에 실패했습니다.');
      } else {
        alert(`품절해제 처리 결과: ${successCount}개 성공, ${failCount}개 실패 (실패: ${failLabels.join(', ')})`);
      }
    } catch (e) {
      console.error('품절해제 처리 중 오류:', e);
    } finally {
      // 로딩 상태 종료
      setApiLoading({});
    }
  };
  const handleAddMinutes = (min) => {
    setDateTime(dt => addMinutesToDateTimeLocal(dt, min));
  };

  const handleTemporaryStop = async () => {
    try {
      // 로딩 상태 시작
      const loadingState = {};
      settings?.checkboxes?.forEach(cb => { loadingState[cb.code] = true; });
      setApiLoading(loadingState);

      // 각 체크박스 code에 대한 API 호출
      const promises = settings?.checkboxes?.map(async (cb) => {
        try {
          const response = await fetch(`/api/${cb.code}/temporary-stop`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: dateTime,
            }),
          });
          
          const responseData = await response.json();
          
          if (!response.ok || !responseData.success) {
            throw new Error(`API 호출 실패: ${cb.code}`);
          }
          
          return { success: true, code: cb.code, data: responseData };
        } catch (error) {
          return { success: false, code: cb.code, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      console.log('임시중지 API 호출 결과:', results);
      
      // 성공/실패 개수 계산
      const successCount = results.filter(r => r.success).length;
      const failResults = results.filter(r => !r.success);
      const failCount = failResults.length;
      // 실패한 code의 label 추출
      const codeToLabel = Object.fromEntries((settings?.checkboxes || []).map(cb => [cb.code, cb.label]));
      const failLabels = failResults.map(r => codeToLabel[r.code]).filter(Boolean);
      
      if (failCount === 0) {
        alert('임시중지가 성공적으로 처리되었습니다.');
      } else if (successCount === 0) {
        alert('모든 임시중지 처리에 실패했습니다.');
      } else {
        alert(`임시중지 처리 결과: ${successCount}개 성공, ${failCount}개 실패 (실패: ${failLabels.join(', ')})`);
      }
    } catch (error) {
      console.error('임시중지 API 호출 중 오류:', error);
      alert('임시중지 처리 중 오류가 발생했습니다.');
    } finally {
      // 로딩 상태 종료
      setApiLoading({});
    }
  };

  const handleReleaseStop = async () => {
    try {
      // 로딩 상태 시작
      const loadingState = {};
      settings?.checkboxes?.forEach(cb => { loadingState[cb.code] = true; });
      setApiLoading(loadingState);

      // 각 체크박스 code에 대한 API 호출
      const promises = settings?.checkboxes?.map(async (cb) => {
        try {
          const response = await fetch(`/api/${cb.code}/release-stop`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          const responseData = await response.json();
          
          if (!response.ok || !responseData.success) {
            throw new Error(`API 호출 실패: ${cb.code}`);
          }
          
          return { success: true, code: cb.code, data: responseData };
        } catch (error) {
          return { success: false, code: cb.code, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      console.log('임시중지해제 API 호출 결과:', results);

      // 성공/실패 개수 계산
      const successCount = results.filter(r => r.success).length;
      const failResults = results.filter(r => !r.success);
      const failCount = failResults.length;
      // 실패한 code의 label 추출
      const codeToLabel = Object.fromEntries((settings?.checkboxes || []).map(cb => [cb.code, cb.label]));
      const failLabels = failResults.map(r => codeToLabel[r.code]).filter(Boolean);
      
      if (failCount === 0) {
        alert('임시중지해제가 성공적으로 처리되었습니다.');
      } else if (successCount === 0) {
        alert('모든 임시중지해제 처리에 실패했습니다.');
      } else {
        alert(`임시중지해제 처리 결과: ${successCount}개 성공, ${failCount}개 실패 (실패: ${failLabels.join(', ')})`);
      }
    } catch (error) {
      console.error('임시중지해제 API 호출 중 오류:', error);
      alert('임시중지해제 처리 중 오류가 발생했습니다.');
    } finally {
      // 로딩 상태 종료
      setApiLoading({});
    }
  }

  if (loading) {
    return (
      <Box sx={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100vw', height: 'calc(100vh - 64px)', bgcolor: theme.palette.background.default, color: theme.palette.text.primary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', pt: 4 }}>
      {/* 최상단 체크박스 label + 로딩/완료 표시 */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
        {settings?.checkboxes?.map((cb, i) => (
          <Box key={cb.code} sx={{ display: 'flex', alignItems: 'center', minWidth: 100 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 18, mr: 1 }}>{cb.label}</Typography>
            {menuLoading[cb.code] || apiLoading[cb.code] ? (
              <CircularProgress size={18} color="primary" />
            ) : (
              <CheckCircleIcon
                sx={{
                  color: settings.checked?.[i]
                    ? theme.palette.success.main
                    : theme.palette.error.main,
                  fontSize: 20,
                }}
              />
            )}
          </Box>
        ))}
      </Stack>
      <Box sx={{ maxWidth: 1200, width: '100%', p: 4, borderRadius: 3, boxShadow: 3, bgcolor: theme.palette.background.paper, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 날짜/시간 입력 및 임시중지 버튼 */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4, width: '100%', justifyContent: 'center' }}>
          <TextField
            type="datetime-local"
            size="small"
            value={dateTime}
            onChange={e => setDateTime(e.target.value)}
            sx={{ minWidth: 220 }}
            InputLabelProps={{ shrink: true }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => handleAddMinutes(30)}>+30분</Button>
            <Button variant="outlined" size="small" onClick={() => handleAddMinutes(60)}>+1시간</Button>
            <Button variant="outlined" size="small" onClick={() => handleAddMinutes(120)}>+2시간</Button>
            <Button variant="contained" size="small" color="primary" onClick={() => setDateTime(getNowDateTimeLocal())}>초기화</Button>
          </Stack>
          <Button variant="outlined" color="secondary" sx={{ fontWeight: 600, minWidth: 120, height: 40 }} onClick={handleTemporaryStop}>
            임시중지
          </Button>
          <Button variant="outlined" color="primary" sx={{ fontWeight: 600, minWidth: 120, height: 40 }} onClick={handleReleaseStop}>
            임시중지해제
          </Button>
        </Stack>
        {/* 공유버튼: Grid로 균등 정렬 */}
        <Grid container spacing={2} sx={{ width: '100%' }}>
          {settings?.sharedButtons?.map(btn => (
            <Grid item key={btn} xs={12} sm={6} md={4}>
              <Box sx={{ m: 2, minWidth: 220 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 22, mb: 2, textAlign: 'center' }}>{btn}</Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button
                    variant="contained"
                    color="error"
                    size="large"
                    onClick={() => handleSoldOut(btn)}
                    sx={{ minWidth: 100, minHeight: 60, fontSize: 20, fontWeight: 700, borderRadius: 2 }}
                  >
                    품절
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={() => handleRelease(btn)}
                    sx={{ minWidth: 100, minHeight: 60, fontSize: 20, fontWeight: 700, borderRadius: 2 }}
                  >
                    품절해제
                  </Button>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}

export default MainPage; 