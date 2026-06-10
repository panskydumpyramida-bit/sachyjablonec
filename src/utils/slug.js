// Slug z titulku: transliterace české diakritiky (NFD), max ~80 znaků
export const createSlug = (title) => {
    return String(title || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/, '');
};
