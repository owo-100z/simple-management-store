import React, { useState, useEffect } from "react";

export default function Modal ({ id, title, body, actions }) {

  return (
    <dialog id={id} className="modal">
    <div className="modal-box">
      {title && (
      <h3 className="font-bold text-lg">{ title }</h3>
      )}
      <div className="modal-body flex justify-center w-full">
      {body}
      </div>
      <div className="modal-action">
        {actions}
        <form method="dialog">
        <button id={`${id}-close`} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
      </div>
    </div>
    {/* ESC or 배경 클릭시 팝업 close */}
    <form method="dialog" className="modal-backdrop">
        <button>close</button>
    </form>
    </dialog>
  )
}