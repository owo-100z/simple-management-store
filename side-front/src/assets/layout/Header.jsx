import React, { useState, useEffect } from "react";
import { Link, useLocation } from 'react-router-dom';
import { SlArrowDown, SlMenu } from "react-icons/sl";

export default function Header() {
    const themes = ['cupcake', 'dim', 'caramellatte', 'retro', 'pastel'];
    const menuList = [
        {title: '홈', menus: [
            { title: '홈', path: '/' },
            { title: '설정', path: '/setting' },
        ]},
    ]

    const location = useLocation();
    const currentMenu = menuList.flatMap(menu => menu.menus).find(menu => menu.path === location.pathname);
    const title = currentMenu ? currentMenu.title : '존재하지 않는 페이지';

    if (currentMenu) {
        menuList.find(menu => menu.menus.includes(currentMenu)).active = true;
    }
    
    return (
      /* 상단바 */
      <div className="navbar bg-base-100 shadow-sm">
          <div className="flex">
              <a className="btn btn-ghost text-xl">{title}</a>
          </div>
          {/* 테마선택 */}
          <div className="flex-1">
              <div className="dropdown">
              <div tabIndex={0} role="button" className="btn m-1">
                Theme
                <SlArrowDown />
              </div>
              <ul tabIndex={0} className="dropdown-content bg-base-300 rounded-box z-1 w-52 p-2 shadow-2xl">
                  {themes.map((theme, idx) => (
                  <li key={idx}>
                      <input
                      type="radio"
                      name="theme-dropdown"
                      className="theme-controller w-full btn btn-sm btn-block btn-ghost justify-start"
                      aria-label={ idx == 0 ? 'Default' : idx === 1 ? 'Dark' : theme }
                      value={theme} />
                  </li>
                  ))}
              </ul>
              </div>
          </div>
          <div className="drawer-content">
              {/* 메뉴 */}
              <div className="drawer drawer-end">
                  <input id="menu-drawer" type="checkbox" className="drawer-toggle" />
                  <label htmlFor="menu-drawer" className="drawer-button btn btn-square btn-ghost">
                  <SlMenu />
              </label>
              <div className="drawer-side">
                  <label htmlFor="menu-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
                  <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
                    {menuList.map((menu, idx) => (
                        <li key={idx}>
                            <details open={menu.active}>
                                <summary>{menu.title}</summary>
                                <ul>
                                    {menu.menus.map((subMenu, sIdx) => (
                                        <li key={sIdx} onClick={() => {document.getElementById('menu-drawer').checked = false;}}>
                                            <Link to={subMenu.path}>{subMenu.title}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        </li>
                    ))}
                  </ul>
              </div>
              </div>
          </div>
      </div>
    )
}