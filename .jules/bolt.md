## 2024-05-18 - getWindAt optimization
**Learning:** `getWindAt` is called frequently (10Hz per boat + for rendering elements). Inside it, sine and cosine are repeatedly calculated for every gust, along with radius divisions.
**Action:** Caching sine/cosine and inverse radius squared for gusts significantly reduces trigonometric and division overhead.
