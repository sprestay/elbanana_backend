window.addEventListener('scroll', function(e) {
   var h = parseInt(document.getElementById("header_hr_chat").style.height);
   var val = (h - window.pageYOffset) >= 0 ? h - window.pageYOffset : 0;
   document.getElementById("floating_group").style.top = val + "px";


   var floating_group = parseInt(document.getElementById("floating_group").style.height);

   if (document.getElementById("group_right")) {
      console.log("setting height", (val + floating_group).toString() + "px");
  
      document.getElementById("group_right").style.top = (window.pageYOffset + val).toString() + "px";
   }
});
    
    
window.addEventListener("load", function(event) {
    var h = parseInt(document.getElementById("header_hr_chat").style.height);
    var val = (h - window.pageYOffset) >= 0 ? h - window.pageYOffset : 0;
    document.getElementById("floating_group").style.top = val + "px";

    var floating_group = parseInt(document.getElementById("floating_group").style.height);

   if (document.getElementById("group_right")) {
      console.log("setting height", (val + floating_group).toString() + "px");
      document.getElementById("group_right").style.top = (window.pageYOffset + val).toString() + "px";
   }
});
    
    
    
    
    
    
    