import React, { useState, useEffect } from "react";
import SettingPopup from '@/views/Setting_P';
import { HiPlus, HiOutlineSearch, HiX } from "react-icons/hi";
import defaultSettings from '@/assets/defaultSettings.json';

const services = [
  {code: 'baemin', label: '배민'},
  {code: 'coupang', label: '쿠팡'},
  {code: 'ddangyo', label: '땡겨요'},
]

export default function Setting() {
  const user_popup_id = "setting_popup";
  const selected_color = "bg-accent";

  const [buttons, setButtons] = useState([]);
  const [menuList, setMenuList] = useState({});
  const [selectedButton, setSelectedButton] = useState('');
  const [selectedList, setSelectedList] = useState({});
  const [selectedService, setSelectedServices] = useState(services[0]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    getSettings();
    getMenus();
  }, [])

  // 세팅 저장
  const save = async () => {
    const keyArr = Object.keys(selectedList);
    
    let adjustList = {};

    keyArr.map((v, i) => {
      const itemKeyArr = Object.keys(selectedList[v]);
      adjustList[v] = {};

      itemKeyArr.map((vv, ii) => {
        adjustList[v][vv] = selectedList[v][vv].filter((t) => {
          const {_type, ...menu} = t;
          const source = _type === 'menuList' ? menuList[v]['menuList']['menuList'] : menuList[v]['menuList']['optionList'];

          if (v === 'baemin') {
            if (_type === 'menuList') {
              return source.find(t => t.menuId === menu.menuId);
            } else if (_type === 'optionList') {
              return source.find(t => t.optionId === menu.optionId);
            }
          } else if (v === 'coupang') {
            if (_type === 'menuList') {
              return source.find(t => t.dishId === menu.dishId);
            } else if (_type === 'optionList') {
              return source.find(t => t.optionItemId === menu.optionItemId);
            }
          } else if (v === 'ddangyo') {
            if (_type === 'menuList') {
              return source.find(t => t.menu_id === menu.menu_id);
            } else if (_type === 'optionList') {
              return source.find(t => t.optn_id === menu.optn_id);
            }
          }

          return true;
        })
      })
    })

    // comm.log(adjustList);

    const config = {buttons, selectedList: adjustList};
    const res = await comm.api('/settings', { method: 'POST', body: {...config} });
    // comm.log(res);
    // comm.log({...config});

    const msg = res?.message || res?.error;
    alert(msg);
  }

  // 세팅 불러오기
  const getSettings = async () => {
    const res = await comm.api('/settings');

    let settings;
    if (res) {
      settings = res;
    } else {
      settings = defaultSettings;
    }

    const btns = settings.buttons;
    const selectedList = settings.selectedList;

    setButtons(btns);
    setSelectedList(selectedList);
    setSelectedButton(btns[0]);
  }
  
  // 메뉴 불러오기
  const getMenus = async () => {
    let menus = {};
    let fail = {};
    for (const service of services) {
      const res = await comm.api(`/${service.code}/get-shop-info`);
      if (res?.success) {
        menus[service.code] = res.data;
      } else {
        fail[service.code] = res.error;
      }
    }

    if (Object.keys(fail).length > 0) {
      alert(Object.keys(fail).join(', ') + ' 조회에 실패하였습니다.');
      comm.log(fail);
    }

    setMenuList(menus);
  }

  // 팝업닫기
  const onClose = (res) => {
    if (!buttons.includes(res)) {
      setButtons([...buttons, res]);
    }
  }

  // 버튼삭제
  const deleteButton = (v) => {
    if (confirm(`${v} 삭제?`)) {
      const btns = buttons.filter(t => t !== v);
      setButtons(btns);
      setSelectedButton(btns[0]);
    }
  }

  // 메뉴선택시 삭제버튼표시
  const selectMenu = (i, v) => {
    const badges = document.getElementsByClassName('indicator-item');

    for(const e of badges) {
      e.classList.add('hidden');
    }

    badges[i].classList.remove('hidden');

    setSelectedButton(v);
    setSearchText('');
  }

  // 메뉴선택
  const selectList = (e, v, _type) => {
    e.target.classList.contains(selected_color) ? e.target.classList.remove(selected_color) : e.target.classList.add(selected_color);

    v = {...v, _type}

    // list 추가
    let list = {...selectedList}

    if (utils.isEmpty(list[selectedService.code])) list[selectedService.code] = {};
    if (utils.isEmpty(list[selectedService.code][selectedButton])) list[selectedService.code][selectedButton] = [];

    const isSelected = list[selectedService.code][selectedButton]?.findIndex(t => JSON.stringify(t) === JSON.stringify(v))
    if (isSelected > -1) {
      list[selectedService.code][selectedButton].splice(isSelected, 1);
    } else {
      list[selectedService.code][selectedButton].push(v);
    }

    setSelectedList(list);
  }

  // 메뉴 선택여부
  const isSelectedMenu = (ref, target) => {
    let res = '';
    if (ref[selectedService.code] && ref[selectedService.code][selectedButton]) {
      res = ref[selectedService.code][selectedButton].find(t => {
        const {_type, ...menu} = t;
        if (selectedService.code === 'baemin') {
          if (_type === 'menuList') {
            return t?.menuId === target?.menuId;
          } else if (_type === 'optionList') {
            return t?.optionId === target?.optionId;
          }
        } else if (selectedService.code === 'coupang') {
          if (_type === 'menuList') {
            return t?.dishId === target?.dishId;
          } else if (_type === 'optionList') {
            return t?.optionItemId === target?.optionItemId;
          }
        } else if (selectedService.code === 'ddangyo') {
          if (_type === 'menuList') {
            return t?.menu_id === target?.menu_id;
          } else if (_type === 'optionList') {
            return t?.optn_id === target?.optn_id;
          }
        }

        return JSON.stringify(menu) === JSON.stringify(target);
      }) ? selected_color : '';
    }
    return res;
  }

  // 메뉴 필터
  const filterMenu = (text) => {
    return text.toLowerCase().includes(searchText.toLowerCase()) ? '' : ' hidden';
  }

  return (
    <>
      <div className="flex-wrap justify-items-center md:justify-items-start">
        <fieldset className="fieldset border-base-300 rounded-box w-auto border p-4 text-end">
          <div>
            <form className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {buttons && buttons.map((v, i) => (
                <div className="indicator w-full" key={i}>
                  <span className={"cursor-pointer indicator-item badge" + (i===0 ? '' : ' hidden')} onClick={() => {deleteButton(v)}}>x</span>
                  <input className="btn w-full" type="radio" name="frameworks" onClick={() => {selectMenu(i, v)}} aria-label={v} defaultChecked={i===0}/>
                </div>
              ))}
            </form>
            <button className="btn mt-2"
              onClick={() => document.getElementById(user_popup_id).showModal()}
            >
            <HiPlus />
              </button>
          </div>
        </fieldset>
        <div className="tabs tabs-box mt-4">
          {services && services.map((v, i) => (
            <input key={i} type="radio" name="my_tabs_1" className="tab" aria-label={v.label} defaultChecked={i===0} onClick={() => {setSelectedServices({...v})}} />
          ))}
        </div>
        <fieldset className="fieldset bg-neutral-content border-base-300 rounded-box w-auto border p-4 grid md:grid-cols-2 mt-1">
          <label className="input md:col-span-2">
            <HiOutlineSearch />
            <input type="search" required placeholder="검색어입력" value={searchText} onInput={(e) => setSearchText(e.target.value)} />
          </label>
          <div>
            <div role="alert" className="alert alert-outline">
              <span>선택 가능한 목록</span>
            </div>
            <div className="max-h-60 overflow-x-auto md:w-3xs mt-1">
              <table className="table table-pin-rows bg-base-200">
                {selectedService && menuList[selectedService.code] ? Object.keys(menuList[selectedService.code]['menuList']).map((v, i) => (
                  <React.Fragment key={i}>
                    <thead>
                      <tr>
                        <th>{v === 'menuList' ? '메뉴' : v === 'optionList' ? '옵션' : v}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuList[selectedService.code]['menuList'][v] ? menuList[selectedService.code]['menuList'][v].map((vv, ii) => (
                        <tr key={ii}>
                          <td className={isSelectedMenu(selectedList, vv) + filterMenu((vv.optn_nm || vv.menu_nm || vv.dishName || vv.menuName || vv.optionName || vv.optionItemName))}
                            onClick={(e)=>{selectList(e, vv, v);}}>
                            { vv.optn_nm || vv.menu_nm || vv.dishName || vv.menuName || vv.optionName || vv.optionItemName }
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td>상품이 없습니다</td>
                        </tr>
                      )}
                    </tbody>
                  </React.Fragment>
                )) : (
                  <tbody>
                    <tr>
                      <td>상품이 없습니다</td>
                    </tr>
                  </tbody>
                )}
              </table>
            </div>
          </div>
          <div>
            <div role="alert" className="alert alert-outline">
              <span>선택된 목록</span>
            </div>
            <div className="max-h-60 overflow-x-auto mt-1">
              <table className="table table-pin-rows bg-base-200">
                <tbody>
                  {selectedButton && selectedService && selectedList[selectedService.code] ? selectedList[selectedService.code][selectedButton]?.map((v, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{ v._type === 'menuList' ? '[메뉴]' : v._type === 'optionList' ? '[옵션]' : `[${v._type}]` }</strong>
                        { v.optn_nm || v.menu_nm || v.dishName || v.menuName || v.optionName || v.optionItemName }
                      </td>
                    </tr>
                  )) : (
                    <tr><th>선택해 주세요</th></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </fieldset>
        <div className="w-full mt-2 grid md:grid-cols-2 gap-2">
          <button className="btn w-full" onClick={save}>저장</button>
          <button className="btn btn-secondary w-full" onClick={getSettings}>불러오기</button>
        </div>
      </div>
      <SettingPopup
        id={user_popup_id}
        onClose={onClose}
      />
    </>
  )
}