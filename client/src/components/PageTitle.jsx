import { usePageTitle } from '../hooks/usePageTitle';

function PageTitle({ title, children }) {
  usePageTitle(title);
  return children;
}

export default PageTitle;