import React, { useState, useEffect } from "react";
import defaultSettings from '@/assets/defaultSettings.json';

// 현재날짜시간 조회
const getToday = (format = 'YYYY-MM-DD HH:mm') => {
  return dayjs().format(format);
}

// 분 더하기
const addMinute = (stdDt, minutes) => {
  return dayjs(stdDt).add(minutes, "minute").format("YYYY-MM-DD HH:mm");
}

// 분 버튼 목록
const addMinutesArr = [
  {minutes: 30, label: '+30분'},
  {minutes: 60, label: '+1시간'},
  {minutes: 120, label: '+2시간'},
]

// 서비스 목록
const services = [
  {code: 'baemin', label: '배민'},
  {code: 'coupang', label: '쿠팡'},
  {code: 'ddangyo', label: '땡겨요'},
]

export default function Home() {
  const [dateTime, setDateTime] = useState(getToday());
  const [loaded, setLoaded] = useState(false);
  const [buttons, setButtons] = useState([]);
  const [selectedService, setSelectedService] = useState('all');
  const [btnMenuList, setBtnMenuList] = useState({});

  useEffect(() => {
    comm.log(getToday());
    getSettings();
  }, [])

  // 분 더하기
  const handleAddMinutes = (min) => {
    setDateTime(dt => addMinute(dt, min));
  };

  // 설정 불러오기
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

    setLoaded(true);
    setButtons(btns);
    setBtnMenuList(selectedList);
  }

  // 임시중지/해제
  const tmpStop = async (is) => {
    let endpoint = '';
    let success = {};
    let fail = {};

    if (is) {
      endpoint = 'temporary-stop';
    } else {
      endpoint = 'release-stop';
    }

    if (selectedService === 'all') {
      for (const service of services) {
        const url = `/${service.code}/${endpoint}`;
        const res = await comm.api(url, { method: 'POST', body: {to: dateTime} });

        comm.log(res);
        if (res?.success) {
          success[service.code] = res.data;
        } else {
          fail[service.code] = res.error;
        }
      }
    } else {
      const url = `/${selectedService}/${endpoint}`;
      const res = await comm.api(url, { method: 'POST', body: {to: dateTime} });

      comm.log(res);
      if (res?.success) {
        success[selectedService] = res.data;
      } else {
        fail[selectedService] = res.error;
      }
    }

    if (Object.keys(fail).length > 0) {
      alert(`[${Object.keys(fail).join(', ')}] 임시중지${is ? '' : '해제'}가 실패하였습니다.`);
      comm.log(fail);
    } else {
      alert(`임시중지${is ? '' : '해제'}가 정상적으로 완료되었습니다.`);
    }
  }

  // 품절/해제
  const soldout = async (is, v) => {
    let endpoint = "";
    let success = {};
    let fail = {};

    if (is) {
      endpoint = 'soldout';
    } else {
      endpoint = 'active';
    }

    comm.log(btnMenuList);

    const makeParam = (service) => {
      const menus = btnMenuList[service];

      if (!utils.isEmpty(menus)) {
        const m = menus[v]?.filter(t => t._type === 'menuList');
        const o = menus[v]?.filter(t => t._type === 'optionList');
  
        const menuList = service === 'baemin' ? m?.map(t => t.menuId)
                        : service === 'coupang' ? m?.map(t => t.dishId)
                        : service === 'ddangyo' ? m : [];
        const optionList = service === 'baemin' ? o?.map(t => t.optionId)
                          : service === 'coupang' ? o?.map(t => t.optionItemId)
                          : service === 'ddangyo' ? o : [];

        return {menuList, optionList};
      }
    }

    if (selectedService === 'all') {
      for (const service of services) {
        const url = `/${service.code}/${endpoint}`;
        const body = makeParam(service.code);

        if (!utils.isEmpty(body)) {
          const res = await comm.api(url, { method: 'POST', body });
  
          comm.log(res);
          if (res?.success) {
            success[service.code] = res.data;
          } else {
            fail[service.code] = res.error;
          }
        }

      }
    } else {
      const url = `/${selectedService}/${endpoint}`;
      const body = makeParam(selectedService);

      if (utils.isEmpty(body)) {
        const res = await comm.api(url, { method: 'POST', body });
  
        comm.log(res);
        if (res?.success) {
          success[selectedService] = res.data;
        } else {
          fail[selectedService] = res.error;
        }
      }
    }

    if (Object.keys(fail).length > 0) {
      alert(`[${Object.keys(fail).join(', ')}] 품절${is ? '이' : '해제가'} 실패하였습니다.`);
      comm.log(fail);
    } else {
      alert(`품절${is ? '이' : '해제가'} 정상적으로 완료되었습니다.`);
    }
  }

  return (
    <>
      <div className="flex w-full max-w-180 flex-col gap-1">
        <div className="card bg-base-200 rounded-box grid p-3 place-items-center">
          <div className="filter flex justify-center">
            <input className="btn filter-reset" type="radio" value="all" name="service" aria-label="All" onChange={(e) => setSelectedService(e.target.value)}/>
            {services && services.map((v, i) => (
              <input key={i} className="btn" type="radio" value={v.code} name="service" aria-label={v.label} onChange={(e) => setSelectedService(e.target.value)}/>
            ))}
          </div>
        </div>
        <div className="card bg-base-200 rounded-box grid p-3 place-items-center">
          <div className="card-body items-center text-center">
            <div className="join">
              {addMinutesArr && addMinutesArr.map((v, i) => (
                <button className="btn btn-xs" onClick={() => {handleAddMinutes(v.minutes);}}>{v.label}</button>
              ))}
              <button className="btn btn-xs" onClick={() => {setDateTime(getToday())}}>초기화</button>
            </div>
            <span>
              <input type="datetime-local" className="input w-55" value={dateTime} onChange={e => setDateTime(e.target.value)} />
              <button className="btn btn-md ml-1 bg-error/20" onClick={() => {tmpStop(true)}}>임시중지</button>
              <button className="btn btn-md ml-1 bg-info/20" onClick={() => {tmpStop(false)}}>임시중지해제</button>
            </span>
          </div>
        </div>
        <div className="card bg-base-100 rounded-box grid p-3 place-items-center">
          <fieldset className="fieldset bg-neutral-content border-base-300 rounded-box w-full md:w-auto border p-4 grid md:grid-cols-3 mt-1">
            {loaded ? (
              <>
                {buttons && buttons.map((v, i) => (
                  <div key={i} className="card bg-base-100 text-base-content">
                    <div className="card-body items-center text-center">
                      <h2 className="card-title">{v}</h2>
                      <div className="card-actions justify-end">
                        <button className="btn bg-error/20" onClick={() => soldout(true, v)}>품절</button>
                        <button className="btn bg-info/20" onClick={() => soldout(false, v)}>해제</button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex w-52 flex-col gap-4">
                <div className="skeleton h-32 w-full"></div>
              </div>
            )}
          </fieldset>
        </div>
      </div>
    </>
  )
}