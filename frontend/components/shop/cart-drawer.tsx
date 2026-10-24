"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Truck
} from "lucide-react"
import confetti from "canvas-confetti"
import type { GoodsItem } from "@/lib/store"
import { Button } from "@/components/ui/button"

export interface CartItem {
  goods: GoodsItem
  quantity: number
}

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  cart: CartItem[]
  onUpdateQuantity: (id: string, delta: number) => void
  onRemoveItem: (id: string) => void
  onClearCart: () => void
}

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartDrawerProps) {
  const [isOrdered, setIsOrdered] = useState(false)

  const subtotal = cart.reduce((sum, item) => sum + item.goods.price * item.quantity, 0)
  const shippingFee = subtotal >= 50000 || subtotal === 0 ? 0 : 3000
  const totalPrice = subtotal + shippingFee

  const handleCheckout = () => {
    alert("덕지몰 COMING SOON: 현재 공식 상품 판매 및 온라인 결제 시스템 점검 중입니다. 스토어 정식 오픈 시 등록된 연락처로 알림을 드리겠습니다!")
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 350, damping: 32 }}
          className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full flex flex-col z-10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h2 className="font-extrabold text-base text-white">
                굿즈 장바구니 ({cart.reduce((a, b) => a + b.quantity, 0)})
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3">
                <ShoppingBag className="w-12 h-12 opacity-30" />
                <p className="text-sm font-medium">장바구니가 비어 있습니다.</p>
                <p className="text-xs text-zinc-600">
                  마음에 드는 팝업 한정 굿즈를 담아보세요!
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.goods.id}
                  className="flex gap-3 bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800/80 items-center"
                >
                  <img
                    src={item.goods.imageUrl}
                    alt={item.goods.name}
                    className="w-16 h-16 rounded-xl object-cover border border-zinc-800 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-emerald-400 truncate">
                      {item.goods.series}
                    </div>
                    <h4 className="text-xs font-bold text-white truncate">
                      {item.goods.name}
                    </h4>
                    <div className="text-xs font-black text-zinc-200 mt-1">
                      {(item.goods.price * item.quantity).toLocaleString()}원
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => onRemoveItem(item.goods.id)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded-lg text-xs">
                      <button
                        onClick={() => onUpdateQuantity(item.goods.id, -1)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-white px-1">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.goods.id, 1)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-zinc-800 bg-zinc-950/80 space-y-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>상품 합계</span>
                  <span className="font-medium text-white">{subtotal.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-zinc-500" />
                    배송비 (5만원 이상 무료)
                  </span>
                  <span className="font-medium text-white">
                    {shippingFee === 0 ? "무료배송" : `${shippingFee.toLocaleString()}원`}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-zinc-800">
                  <span>최종 결제 금액</span>
                  <span className="text-emerald-400 text-base">{totalPrice.toLocaleString()}원</span>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/40 font-extrabold h-12 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>덕지몰 COMING SOON (결제 준비중)</span>
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
