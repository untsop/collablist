import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ListPage from './pages/ListPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/l/:token" element={<ListPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
