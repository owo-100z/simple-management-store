import { useState, useEffect, createContext, useMemo, memo } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { useTheme, CircularProgress } from '@mui/material';

// Context for shopInfo 전역 저장
const ShopInfoContext = createContext({});
//export const useShopInfo = () => useContext(ShopInfoContext);

function SettingsPage({ settings: propsSettings, shopInfos: propsShopInfos, menuLists: propsMenuLists, loading: propsLoading, onSaveSettings }) {
  const theme = useTheme();
  // 상태: props가 있으면 그걸로, 없으면 기본값
  const [checkboxes, setCheckboxes] = useState(propsSettings?.checkboxes || []);
  const [checked, setChecked] = useState(propsSettings?.checked || [false, false, false]);
  const [activeTab, setActiveTab] = useState(0);
  const [sharedButtons, setSharedButtons] = useState(propsSettings?.sharedButtons || []);
  const [newButtonName, setNewButtonName] = useState('');
  const [selectedRadio, setSelectedRadio] = useState(propsSettings?.sharedButtons?.[0] || null);
  const [selectedMap, setSelectedMap] = useState(propsSettings?.selectedMap || []);
  // 탭별 menuList 상태
  const [menuLists, setMenuLists] = useState(propsMenuLists || {});
  // shopInfo 전역 저장
  const [shopInfos, setShopInfos] = useState(propsShopInfos || {});
  // 로딩 상태
  const [loading, setLoading] = useState(propsLoading || false);
  const [search, setSearch] = useState('');
  const [menuLoading, setMenuLoading] = useState({});

  // props가 바뀌면 상태 동기화
  useEffect(() => {
    if (propsSettings) {
      setCheckboxes(propsSettings.checkboxes || []);
      setChecked(propsSettings.checked || [false, false, false]);
      setSharedButtons(propsSettings.sharedButtons || []);
      setSelectedRadio(propsSettings.sharedButtons?.[0] || null);
      setSelectedMap(propsSettings.selectedMap || []);
    }
    if (propsMenuLists) setMenuLists(propsMenuLists);
    if (propsShopInfos) setShopInfos(propsShopInfos);
    setLoading(propsLoading || false);
  }, [propsSettings, propsMenuLists, propsShopInfos, propsLoading]);

  // propsMenuLists가 있으면 menuLoading을 모두 false로 세팅
  useEffect(() => {
    if (propsMenuLists && checkboxes.length) {
      const loadingObj = {};
      checkboxes.forEach(cb => { loadingObj[cb.code] = false; });
      setMenuLoading(loadingObj);
    }
  }, [propsMenuLists, checkboxes]);

  // 체크박스 label 변경 핸들러
  const handleCheckboxLabelChange = (i, value) => {
    setCheckboxes(prev => prev.map((item, idx) => idx === i ? { ...item, label: value } : item));
  };

  // get-shop-info fetch는 propsMenuLists가 없을 때만(최초 진입 등)만 동작
  useEffect(() => {
    if (propsMenuLists || !checkboxes.length) return;
    let isMounted = true;
    //let loadedCount = 0;
    checkboxes.forEach(({ code }) => {
      setMenuLoading(prev => ({ ...prev, [code]: true }));
      fetch(`/api/${code}/get-shop-info`)
        .then(res => res.json())
        .then(res => {
          if (!isMounted) return;
          if (res.success) {
            setShopInfos(prev => ({ ...prev, [code]: res.data.shopInfo }));
            setMenuLists(prev => ({ ...prev, [code]: res.data.menuList }));
          }
        })
        .finally(() => {
          setMenuLoading(prev => ({ ...prev, [code]: false }));
          //loadedCount++;
        });
    });
    return () => { isMounted = false; };
  }, [checkboxes, propsMenuLists]);

  const handleAddButton = () => {
    if (!newButtonName.trim()) return;
    const btnName = newButtonName.trim();
    setSharedButtons(prev => {
      setSelectedMap(map =>
        map.map(tabObj => ({ ...tabObj, [btnName]: [] }))
      );
      setSelectedRadio(prevRadio => prevRadio || btnName);
      return [...prev, btnName];
    });
    setNewButtonName('');
  };

  const handleRadioChange = (e) => {
    setSelectedRadio(e.target.value);
    setSearch(''); // 버튼리스트(공유버튼) 선택 시 검색어 초기화
  };

  const handleCheckbox = i => {
    setChecked(prev => prev.map((v, idx) => (i === idx ? !v : v)));
  };

  // 선택 시 메뉴/옵션 구분값을 포함해서 저장
  const handleSelect = (item, type) => {
    const btn = selectedRadio;
    const itemWithType = item && typeof item === 'object' && !item._type ? { ...item, _type: type } : item;
    setSelectedMap(prev =>
      prev.map((tabObj, tabIdx) =>
        tabIdx === activeTab
          ? {
              ...tabObj,
              [btn]: tabObj[btn].some(x => {
                const { _type, ...restX } = x || {};
                return JSON.stringify(restX) === JSON.stringify(item);
              })
                ? tabObj[btn].filter(x => {
                    const { _type, ...restX } = x || {};
                    return JSON.stringify(restX) !== JSON.stringify(item);
                  })
                : [...tabObj[btn], itemWithType],
            }
          : tabObj
      )
    );
  };

  const listBoxStyle = {
    flex: 1,
    bgcolor: theme.palette.background.paper,
    borderRadius: 2,
    boxShadow: 1,
    p: 2,
    border: `1px solid ${theme.palette.divider}`,
    minWidth: 0,
    maxHeight: 260,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    '&::-webkit-scrollbar': {
      width: 8,
      background: theme.palette.background.paper,
    },
    '&::-webkit-scrollbar-thumb': {
      background: theme.palette.mode === 'dark' ? '#444a58' : '#d1d5db',
      borderRadius: 8,
    },
    '&::-webkit-scrollbar-thumb:hover': {
      background: theme.palette.mode === 'dark' ? '#646cff' : '#90caf9',
    },
    scrollbarColor: `${theme.palette.mode === 'dark' ? '#444a58' : '#d1d5db'} ${theme.palette.background.paper}`,
    scrollbarWidth: 'thin',
  };

  const mergedButtons = sharedButtons;
  const currentRadio = selectedRadio || mergedButtons[0];
  const currentCode = checkboxes[activeTab]?.code;
  const currentLabel = checkboxes[activeTab]?.label;
  // menuList 구조: { menuList: [...], optionList: [...] }
  const selectableMenuList = useMemo(() => 
    (menuLists[currentCode]?.menuList) || [], 
    [menuLists, currentCode]
  );
  const selectableOptionList = useMemo(() => 
    (menuLists[currentCode]?.optionList) || [], 
    [menuLists, currentCode]
  );
  // 검색 필터 적용 (useMemo로 최적화)
  const filteredMenuList = useMemo(() =>
    selectableMenuList.filter(item =>
      (item.dishName || item.menuName || item.menu_nm || '').toLowerCase().includes(search.toLowerCase())
    ), [selectableMenuList, search]
  );
  const filteredOptionList = useMemo(() =>
    selectableOptionList.filter(item =>
      (item.optionName || item.optionItemName || item.optn_nm || '').toLowerCase().includes(search.toLowerCase())
    ), [selectableOptionList, search]
  );
  const selectedList = selectedMap[activeTab]?.[currentRadio] || [];

  // 저장 함수
  const handleSave = async () => {
    const payload = {
      checkboxes,
      sharedButtons,
      selectedMap,
      checked, // 체크여부도 저장
    };
    if (onSaveSettings) {
      await onSaveSettings(payload); // App의 상태도 갱신
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <ShopInfoContext.Provider value={shopInfos}>
      <Box sx={{
        width: '100vw',
        height: '100vh',
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Box sx={{ maxWidth: 900, width: '100%', p: 4, borderRadius: 3, boxShadow: 3, bgcolor: theme.palette.background.default, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Stack direction="row" spacing={3} mb={4} justifyContent="center" alignItems="center">
            {checkboxes.map((item, i) => (
              <Stack key={item.code} direction="row" spacing={1} alignItems="center">
                <TextField
                  value={item.label}
                  onChange={e => handleCheckboxLabelChange(i, e.target.value)}
                  size="small"
                  sx={{ width: 110, input: { color: theme.palette.text.primary }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.primary.main }, '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }, background: theme.palette.background.paper } }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked[i]}
                      onChange={() => handleCheckbox(i)}
                      color="primary"
                      sx={{ color: theme.palette.text.primary, '&.Mui-checked': { color: theme.palette.primary.main } }}
                    />
                  }
                  label=""
                  sx={{ color: theme.palette.text.primary }}
                />
              </Stack>
            ))}
          </Stack>
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            centered
            sx={{ mb: 3, '.MuiTab-root': { color: theme.palette.text.primary }, '.Mui-selected': { color: theme.palette.primary.main + '!important' } }}
            TabIndicatorProps={{ style: { background: theme.palette.primary.main } }}
          >
            {checkboxes.map((item, i) => (
              <Tab key={item.code} label={item.label + ' 탭'} value={i} />
            ))}
          </Tabs>
          <Stack direction="row" spacing={3} mb={4} justifyContent="center" alignItems="flex-start" width="100%">
            <Box sx={listBoxStyle}>
              <strong style={{ color: theme.palette.text.primary }}>버튼 리스트</strong>
              <RadioGroup
                value={currentRadio}
                onChange={handleRadioChange}
                sx={{ mt: 1 }}
              >
                {mergedButtons.map(btn => (
                  <FormControlLabel
                    key={btn}
                    value={btn}
                    control={<Radio sx={{ color: theme.palette.text.secondary, '&.Mui-checked': { color: theme.palette.primary.main } }} />}
                    label={<span style={{ color: theme.palette.text.primary }}>{btn}</span>}
                  />
                ))}
              </RadioGroup>
              <Stack direction="row" spacing={1} mt={2} alignItems="center">
                <TextField
                  size="small"
                  variant="outlined"
                  placeholder="버튼 이름 입력"
                  value={newButtonName}
                  onChange={e => setNewButtonName(e.target.value)}
                  sx={{ input: { color: theme.palette.text.primary }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.primary.main }, '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }, background: theme.palette.background.paper } }}
                  InputProps={{ style: { color: theme.palette.text.primary } }}
                />
                <Button variant="contained" color="primary" onClick={handleAddButton} sx={{ fontWeight: 600, height: 40 }}>
                  추가
                </Button>
              </Stack>
            </Box>
            <Box sx={listBoxStyle}>
              <strong style={{ color: theme.palette.text.primary }}>선택 가능한 리스트 ({currentLabel})</strong>
              <TextField
                size="small"
                variant="outlined"
                placeholder="메뉴/옵션 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{ mb: 1, width: '100%' }}
                InputProps={{ style: { color: theme.palette.text.primary } }}
              />
              {(menuLoading[currentCode] === undefined || menuLoading[currentCode]) ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 180 }}>
                  <CircularProgress color="primary" />
                </Box>
              ) : (
                <>
                  <strong style={{ color: theme.palette.text.primary, fontSize: 16, marginTop: 8 }}>메뉴 ({ filteredMenuList.length })</strong>
                  <List dense>
                    {filteredMenuList.map(item => (
                      <MenuListItem
                        key={item.dishId || item.menuId || item.menu_id || item}
                        item={item}
                        checked={selectedMap[activeTab]?.[currentRadio]?.some(x => {
                          const { _type, ...restX } = x || {};
                          return JSON.stringify(restX) === JSON.stringify(item);
                        }) || false}
                        onSelect={handleSelect}
                        theme={theme}
                        selectedMap={selectedMap}
                        activeTab={activeTab}
                        currentRadio={currentRadio}
                      />
                    ))}
                  </List>
                  <strong style={{ color: theme.palette.text.primary, fontSize: 16, marginTop: 8 }}>옵션 ({ filteredOptionList.length })</strong>
                  <List dense>
                    {filteredOptionList.map(item => (
                      <OptionListItem
                        key={item.optionId || item.optionItemId || item.optn_id || item}
                        item={item}
                        checked={selectedMap[activeTab]?.[currentRadio]?.some(x => {
                          const { _type, ...restX } = x || {};
                          return JSON.stringify(restX) === JSON.stringify(item);
                        }) || false}
                        onSelect={handleSelect}
                        theme={theme}
                        selectedMap={selectedMap}
                        activeTab={activeTab}
                        currentRadio={currentRadio}
                      />
                    ))}
                  </List>
                </>
              )}
            </Box>
            <Box sx={listBoxStyle}>
              <strong style={{ color: theme.palette.text.primary }}>선택된 리스트</strong>
              <List dense>
                {selectedList.length > 0 ? (
                  selectedList.map(item => {
                    let type = '';
                    if (item?._type === 'menu' && (item.dishName || item.menuName || item.menu_nm)) type = '[메뉴] ';
                    else if (item?._type === 'option' && (item.optionName || item.optionItemName || item.optn_nm)) type = '[옵션] ';
                    return (
                      <ListItem
                        key={item.dishId || item.menuId || item.menu_id || item.optionId || item.optionItemId || item.optn_id || item}
                        disablePadding
                        disableGutters
                        sx={{ minHeight: 32, py: 0.25 }}
                      >
                        <ListItemText
                          primary={
                            <span
                              className="hide-scrollbar"
                              style={{
                                display: 'block',
                                maxWidth: 180,
                                overflowX: 'auto',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {type + (item?._type === 'menu' && (item.dishName || item.menuName || item.menu_nm) || item?._type === 'option' && (item.optionName || item.optionItemName || item.optn_nm) || JSON.stringify(item))}
                            </span>
                          }
                          sx={{ color: theme.palette.text.primary, m: 0 }}
                        />
                      </ListItem>
                    );
                  })
                ) : (
                  <ListItem disablePadding disableGutters sx={{ minHeight: 32, py: 0.25 }}>
                    <ListItemText primary="선택된 항목이 없습니다." sx={{ color: theme.palette.text.secondary, m: 0 }} />
                  </ListItem>
                )}
              </List>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2} justifyContent="center" mt={6}>
            <Button variant="contained" color="primary" sx={{ fontWeight: 600 }} onClick={handleSave}>저장</Button>
            <Button variant="outlined" color="primary" sx={{ fontWeight: 600 }}>초기화</Button>
            <Button variant="outlined" color="secondary" sx={{ fontWeight: 600 }}>메뉴리로드</Button>
          </Stack>
        </Box>
      </Box>
    </ShopInfoContext.Provider>
  );
}

// 리스트 항목 컴포넌트 메모이제이션
const MenuListItem = memo(function MenuListItem({ item, checked, onSelect, theme }) {
  return (
    <ListItem
      key={item.dishId || item.menuId || item.menu_id || item}
      disablePadding
      disableGutters
      sx={{ minHeight: 32 }}
    >
      <ListItemButton
        onClick={() => onSelect(item, 'menu')}
        sx={{
          color: theme.palette.text.primary,
          py: 0.25,
          px: 1,
          minHeight: 32,
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Checkbox
            edge="start"
            checked={checked}
            tabIndex={-1}
            disableRipple
            color="primary"
            sx={{ color: theme.palette.text.secondary, '&.Mui-checked': { color: theme.palette.primary.main } }}
          />
        </ListItemIcon>
        <ListItemText
          primary={
            <span
              className="hide-scrollbar"
              style={{
                display: 'block',
                maxWidth: 180,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {typeof item === 'string'
                ? item
                : item.dishName || item.menuName || item.menu_nm || JSON.stringify(item)}
            </span>
          }
          sx={{ color: theme.palette.text.primary }}
        />
      </ListItemButton>
    </ListItem>
  );
});

const OptionListItem = memo(function OptionListItem({ item, checked, onSelect, theme }) {
  return (
    <ListItem
      key={item.optionId || item.optionItemId || item.optn_id || item}
      disablePadding
      disableGutters
      sx={{ minHeight: 32 }}
    >
      <ListItemButton
        onClick={() => onSelect(item, 'option')}
        sx={{
          color: theme.palette.text.primary,
          py: 0.25,
          px: 1,
          minHeight: 32,
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Checkbox
            edge="start"
            checked={checked}
            tabIndex={-1}
            disableRipple
            color="primary"
            sx={{ color: theme.palette.text.secondary, '&.Mui-checked': { color: theme.palette.primary.main } }}
          />
        </ListItemIcon>
        <ListItemText
          primary={
            <span
              className="hide-scrollbar"
              style={{
                display: 'block',
                maxWidth: 180,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {typeof item === 'string'
                ? item
                : item.optionName || item.optionItemName || item.optn_nm || JSON.stringify(item)}
            </span>
          }
          sx={{ color: theme.palette.text.primary }}
        />
      </ListItemButton>
    </ListItem>
  );
});

export default SettingsPage; 