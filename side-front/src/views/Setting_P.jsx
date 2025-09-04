import React, { useState, useEffect } from "react";
import Modal from "@/components/Modal";

export default function UsersPopup({ id, onClose }) {
  const [menu, setMenu] = useState('');

  const save = async () => {
    if (utils.isEmpty(menu)) {
        alert('메뉴명을 입력하세요');
        return;
    }

    setMenu('');
    document.getElementById(`${id}-close`).click();
    if (onClose) onClose(menu);
  }

  return (
    <Modal
      id={id}
      body={
        <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 mt-4 gap-4">
          <div className="join">
            <input className="input join-item w-full" placeholder="메뉴" value={menu} onChange={(e) => {setMenu(e.target.value)}} />
            <button className="btn join-item rounded-r-full" onClick={save}>추가</button>
          </div>
        </fieldset>
      }
    />
  )
}