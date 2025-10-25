import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AddOn = {
  name: string;
  price: number;
};

export type CartItem = {
  id: number;
  title: string;
  category: string;
  price: number;
  quantity: number;
  img: string;
  slug: string;
  selectedAddOns: AddOn[];
};

interface CartState {
  items: CartItem[];
  promoCode: string | null;
  promoDiscountPercent: number;
  addToCart: (itemToAdd: Omit<CartItem, 'quantity' | 'selectedAddOns'>, quantity: number, addOns: AddOn[]) => void;
  removeFromCart: (itemId: number) => void;
  increaseQuantity: (itemId: number) => void;
  decreaseQuantity: (itemId: number) => void;
  setPromo: (code: string, percent: number) => void;
  clearPromo: () => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      promoDiscountPercent: 0,
      addToCart: (itemToAdd, quantity, addOns) => {
        const items = get().items;
        const existingItemIndex = items.findIndex((i) => i.id === itemToAdd.id);

        if (existingItemIndex > -1) {
          const updatedItems = [...items];
          updatedItems[existingItemIndex].quantity += quantity;
          const newAddons = [...updatedItems[existingItemIndex].selectedAddOns, ...addOns];
          updatedItems[existingItemIndex].selectedAddOns = newAddons.filter((v,i,a)=>a.findIndex(t=>(t.name === v.name))===i);
          set({ items: updatedItems });
        } else {
          set({ items: [...items, { ...itemToAdd, quantity, selectedAddOns: addOns }] });
        }
      },
      removeFromCart: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        }));
      },
      increaseQuantity: (itemId) => {
        set((state) => ({
          items: state.items.map(item =>
            item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
          ),
        }));
      },
      decreaseQuantity: (itemId) => {
        const items = get().items;
        const existingItem = items.find(i => i.id === itemId);

        if (existingItem && existingItem.quantity > 1) {
          const updatedItems = items.map(item =>
            item.id === itemId ? { ...item, quantity: item.quantity - 1 } : item
          );
          set({ items: updatedItems });
        } else {
          get().removeFromCart(itemId);
        }
      },
      setPromo: (code, percent) => {
        set({ promoCode: code.toUpperCase(), promoDiscountPercent: percent });
      },
      clearPromo: () => {
        set({ promoCode: null, promoDiscountPercent: 0 });
      },
      clearCart: () => {
        set({ items: [], promoCode: null, promoDiscountPercent: 0 });
      },
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
