import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from "@/views/Home";
import Setting from '@/views/Setting';
import Error404 from '@/assets/err/Error404';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setting" element={<Setting />} />
      <Route path="*" element={<Error404 />}/>
    </Routes>
  )
}